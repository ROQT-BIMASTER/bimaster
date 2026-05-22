CREATE OR REPLACE FUNCTION public.crm_ingest_message(
  p_bot_id uuid, p_external_thread text, p_blip_msg_id text,
  p_direction crm_msg_direction, p_tipo crm_msg_tipo, p_conteudo text,
  p_midia_url text, p_midia_mime text, p_contato_nome text,
  p_contato_telefone text, p_contato_email text,
  p_criada_em timestamp with time zone, p_metadata jsonb
)
RETURNS TABLE(mensagem_id uuid, conversa_id uuid, contato_id uuid, duplicated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  SELECT empresa_id, provider, canal INTO v_empresa, v_provider, v_canal
    FROM public.crm_bots WHERE id = p_bot_id;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'bot not found'; END IF;

  v_phone := public.crm_normalize_phone(p_contato_telefone);

  SELECT ci.contato_id INTO v_contato
    FROM public.crm_contato_identidades ci
    WHERE ci.provider = v_provider AND ci.external_id = p_external_thread
      AND (ci.bot_id = p_bot_id OR ci.bot_id IS NULL)
    LIMIT 1;

  IF v_contato IS NULL AND v_phone IS NOT NULL THEN
    SELECT c.id INTO v_contato FROM public.crm_contatos c
     WHERE c.empresa_id = v_empresa AND c.telefone_normalizado = v_phone LIMIT 1;
  END IF;

  IF v_contato IS NULL AND p_contato_email IS NOT NULL THEN
    SELECT c.id INTO v_contato FROM public.crm_contatos c
     WHERE c.empresa_id = v_empresa AND lower(c.email) = lower(p_contato_email) LIMIT 1;
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
    UPDATE public.crm_contatos c SET
      nome = coalesce(c.nome, p_contato_nome),
      telefone = coalesce(c.telefone, p_contato_telefone),
      telefone_normalizado = coalesce(c.telefone_normalizado, v_phone),
      email = coalesce(c.email, p_contato_email),
      ultimo_contato_em = greatest(coalesce(c.ultimo_contato_em, p_criada_em), coalesce(p_criada_em, now())),
      updated_at = now()
    WHERE c.id = v_contato;
  END IF;

  INSERT INTO public.crm_contato_identidades (contato_id, provider, external_id, bot_id)
    VALUES (v_contato, v_provider, p_external_thread, p_bot_id)
    ON CONFLICT (provider, external_id, bot_id) DO NOTHING;

  SELECT cv.id INTO v_conversa FROM public.crm_conversas cv
    WHERE cv.bot_id = p_bot_id AND cv.external_id = p_external_thread
    ORDER BY cv.iniciada_em DESC LIMIT 1;

  IF v_conversa IS NULL THEN
    INSERT INTO public.crm_conversas (
      empresa_id, bot_id, contato_id, canal, status, owner,
      external_id, iniciada_em, ultima_mensagem_em
    ) VALUES (
      v_empresa, p_bot_id, v_contato, v_canal, 'open', 'blip',
      p_external_thread, coalesce(p_criada_em, now()), coalesce(p_criada_em, now())
    ) RETURNING id INTO v_conversa;
  ELSE
    UPDATE public.crm_conversas cv SET
      contato_id = coalesce(cv.contato_id, v_contato),
      ultima_mensagem_em = greatest(cv.ultima_mensagem_em, coalesce(p_criada_em, now())),
      updated_at = now()
    WHERE cv.id = v_conversa;
  END IF;

  IF p_blip_msg_id IS NOT NULL THEN
    SELECT m.id INTO v_msg FROM public.crm_mensagens m WHERE m.blip_id = p_blip_msg_id LIMIT 1;
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
$function$;