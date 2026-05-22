
-- Normaliza telefone (E.164 simplificado: só dígitos)
CREATE OR REPLACE FUNCTION public.crm_normalize_phone(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g'), '');
$$;

-- Ingest atômico de uma mensagem
CREATE OR REPLACE FUNCTION public.crm_ingest_message(
  p_bot_id uuid,
  p_external_thread text,       -- id da thread/contato no provider
  p_blip_msg_id text,           -- id único da mensagem no provider
  p_direction crm_msg_direction,
  p_tipo crm_msg_tipo,
  p_conteudo text,
  p_midia_url text,
  p_midia_mime text,
  p_contato_nome text,
  p_contato_telefone text,
  p_contato_email text,
  p_criada_em timestamptz,
  p_metadata jsonb
)
RETURNS TABLE(mensagem_id uuid, conversa_id uuid, contato_id uuid, duplicated boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_empresa integer;
  v_provider crm_provider;
  v_canal crm_canal;
  v_contato uuid;
  v_conversa uuid;
  v_msg uuid;
  v_dup boolean := false;
  v_phone text;
BEGIN
  -- 1) Bot
  SELECT empresa_id, provider, canal INTO v_empresa, v_provider, v_canal
    FROM public.crm_bots WHERE id = p_bot_id;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'bot not found'; END IF;

  v_phone := public.crm_normalize_phone(p_contato_telefone);

  -- 2) Contato — match por identidade externa, telefone ou email
  SELECT contato_id INTO v_contato
    FROM public.crm_contato_identidades
    WHERE provider = v_provider AND external_id = p_external_thread
      AND (bot_id = p_bot_id OR bot_id IS NULL)
    LIMIT 1;

  IF v_contato IS NULL AND v_phone IS NOT NULL THEN
    SELECT id INTO v_contato FROM public.crm_contatos
     WHERE empresa_id = v_empresa AND telefone_normalizado = v_phone LIMIT 1;
  END IF;

  IF v_contato IS NULL AND p_contato_email IS NOT NULL THEN
    SELECT id INTO v_contato FROM public.crm_contatos
     WHERE empresa_id = v_empresa AND lower(email) = lower(p_contato_email) LIMIT 1;
  END IF;

  IF v_contato IS NULL THEN
    INSERT INTO public.crm_contatos (
      empresa_id, nome, telefone, telefone_normalizado, email,
      primeiro_contato_em, ultimo_contato_em, origem
    ) VALUES (
      v_empresa, p_contato_nome, p_contato_telefone, v_phone, p_contato_email,
      coalesce(p_criada_em, now()), coalesce(p_criada_em, now()), v_provider::text
    ) RETURNING id INTO v_contato;
  ELSE
    UPDATE public.crm_contatos SET
      nome = coalesce(nome, p_contato_nome),
      telefone = coalesce(telefone, p_contato_telefone),
      telefone_normalizado = coalesce(telefone_normalizado, v_phone),
      email = coalesce(email, p_contato_email),
      ultimo_contato_em = greatest(coalesce(ultimo_contato_em, p_criada_em), coalesce(p_criada_em, now())),
      updated_at = now()
    WHERE id = v_contato;
  END IF;

  -- Identidade externa
  INSERT INTO public.crm_contato_identidades (contato_id, provider, external_id, bot_id)
    VALUES (v_contato, v_provider, p_external_thread, p_bot_id)
    ON CONFLICT (provider, external_id, bot_id) DO NOTHING;

  -- 3) Conversa (1 aberta por bot+external_thread)
  SELECT id INTO v_conversa FROM public.crm_conversas
    WHERE bot_id = p_bot_id AND external_id = p_external_thread
    ORDER BY iniciada_em DESC LIMIT 1;

  IF v_conversa IS NULL THEN
    INSERT INTO public.crm_conversas (
      empresa_id, bot_id, contato_id, canal, status, owner,
      external_id, iniciada_em, ultima_mensagem_em
    ) VALUES (
      v_empresa, p_bot_id, v_contato, v_canal, 'open', 'blip',
      p_external_thread, coalesce(p_criada_em, now()), coalesce(p_criada_em, now())
    ) RETURNING id INTO v_conversa;
  ELSE
    UPDATE public.crm_conversas SET
      contato_id = coalesce(contato_id, v_contato),
      ultima_mensagem_em = greatest(ultima_mensagem_em, coalesce(p_criada_em, now())),
      updated_at = now()
    WHERE id = v_conversa;
  END IF;

  -- 4) Mensagem (dedupe por blip_id)
  IF p_blip_msg_id IS NOT NULL THEN
    SELECT id INTO v_msg FROM public.crm_mensagens WHERE blip_id = p_blip_msg_id LIMIT 1;
    IF v_msg IS NOT NULL THEN
      v_dup := true;
      RETURN QUERY SELECT v_msg, v_conversa, v_contato, v_dup;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.crm_mensagens (
    empresa_id, conversa_id, blip_id, direction, tipo, conteudo,
    midia_url, midia_mime, metadata, criada_em
  ) VALUES (
    v_empresa, v_conversa, p_blip_msg_id, p_direction, p_tipo, p_conteudo,
    p_midia_url, p_midia_mime, coalesce(p_metadata, '{}'::jsonb), coalesce(p_criada_em, now())
  ) RETURNING id INTO v_msg;

  RETURN QUERY SELECT v_msg, v_conversa, v_contato, v_dup;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_ingest_message(uuid, text, text, crm_msg_direction, crm_msg_tipo, text, text, text, text, text, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;

-- Segredo HMAC do bot (uso interno)
CREATE OR REPLACE FUNCTION public.crm_bot_get_webhook_secret(p_bot_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT webhook_secret INTO v FROM public.crm_bots WHERE id = p_bot_id;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.crm_bot_get_webhook_secret(uuid) FROM PUBLIC, anon, authenticated;

-- Atualiza ultimo_sync_at / ultimo_erro
CREATE OR REPLACE FUNCTION public.crm_bot_touch_sync(p_bot_id uuid, p_erro text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.crm_bots SET
    ultimo_sync_at = now(),
    ultimo_erro = p_erro,
    updated_at = now()
  WHERE id = p_bot_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crm_bot_touch_sync(uuid, text) FROM PUBLIC, anon, authenticated;
