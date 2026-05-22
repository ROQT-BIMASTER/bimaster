
-- Helper: encrypt/decrypt como text (base64) para reaproveitar coluna text
CREATE OR REPLACE FUNCTION public.crm_encrypt_secret(p_plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_plaintext IS NULL OR p_plaintext = '' THEN RETURN NULL; END IF;
  RETURN encode(public.encrypt_token(p_plaintext), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_decrypt_secret(p_ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_key text;
BEGIN
  IF p_ciphertext IS NULL OR p_ciphertext = '' THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'oauth_encryption_key' LIMIT 1;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'oauth_encryption_key not found in Vault';
  END IF;
  RETURN extensions.pgp_sym_decrypt(decode(p_ciphertext, 'base64')::bytea, v_key);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_encrypt_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_decrypt_secret(text) FROM PUBLIC, anon, authenticated;

-- Upsert bot (cifra chave server-side)
CREATE OR REPLACE FUNCTION public.crm_bot_upsert(
  p_id uuid,
  p_empresa_id integer,
  p_nome text,
  p_descricao text,
  p_provider crm_provider,
  p_canal crm_canal,
  p_identificador_externo text,
  p_numero_whatsapp text,
  p_bot_key text,
  p_modo_leitura boolean,
  p_ativo boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.crm_has_access(p_empresa_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.crm_bots (
      empresa_id, nome, descricao, provider, canal,
      identificador_externo, numero_whatsapp, bot_key_cifrada,
      modo_leitura, ativo, created_by
    ) VALUES (
      p_empresa_id, p_nome, p_descricao, p_provider, p_canal,
      p_identificador_externo, p_numero_whatsapp,
      public.crm_encrypt_secret(p_bot_key),
      coalesce(p_modo_leitura, true),
      coalesce(p_ativo, true),
      auth.uid()
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.crm_bots SET
      nome = p_nome,
      descricao = p_descricao,
      provider = p_provider,
      canal = p_canal,
      identificador_externo = p_identificador_externo,
      numero_whatsapp = p_numero_whatsapp,
      bot_key_cifrada = CASE
        WHEN p_bot_key IS NOT NULL AND p_bot_key <> ''
          THEN public.crm_encrypt_secret(p_bot_key)
        ELSE bot_key_cifrada
      END,
      modo_leitura = coalesce(p_modo_leitura, modo_leitura),
      ativo = coalesce(p_ativo, ativo),
      updated_at = now()
    WHERE id = p_id AND empresa_id = p_empresa_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'bot not found';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- Get decrypted key (uso restrito a edge functions service role)
CREATE OR REPLACE FUNCTION public.crm_bot_get_key(p_bot_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_cif text; v_empresa integer;
BEGIN
  SELECT bot_key_cifrada, empresa_id INTO v_cif, v_empresa
  FROM public.crm_bots WHERE id = p_bot_id;
  IF v_cif IS NULL THEN RETURN NULL; END IF;
  -- Permite se for service_role ou usuário com acesso à empresa
  IF auth.role() <> 'service_role' AND NOT public.crm_has_access(v_empresa) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN public.crm_decrypt_secret(v_cif);
END;
$$;

REVOKE ALL ON FUNCTION public.crm_bot_get_key(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_bot_get_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_bot_upsert(uuid, integer, text, text, crm_provider, crm_canal, text, text, text, boolean, boolean) TO authenticated;
