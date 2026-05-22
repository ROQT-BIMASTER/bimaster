-- Auth format / environment / last test result
ALTER TABLE public.crm_bots
  ADD COLUMN IF NOT EXISTS auth_format text NOT NULL DEFAULT 'raw'
    CHECK (auth_format IN ('raw','identifier_pair')),
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'prod'
    CHECK (environment IN ('prod','hmg')),
  ADD COLUMN IF NOT EXISTS last_test_identity text,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_ok boolean;

-- Persistir resultado de teste (chamado pela edge function via service_role)
CREATE OR REPLACE FUNCTION public.crm_bot_record_test_result(
  p_bot_id uuid,
  p_ok boolean,
  p_format text,
  p_env text,
  p_identity text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_format IS NOT NULL AND p_format NOT IN ('raw','identifier_pair') THEN
    RAISE EXCEPTION 'auth_format inválido: %', p_format;
  END IF;
  IF p_env IS NOT NULL AND p_env NOT IN ('prod','hmg') THEN
    RAISE EXCEPTION 'environment inválido: %', p_env;
  END IF;

  UPDATE public.crm_bots
  SET
    last_test_ok = p_ok,
    last_test_at = now(),
    last_test_identity = p_identity,
    auth_format = COALESCE(p_format, auth_format),
    environment = COALESCE(p_env, environment)
  WHERE id = p_bot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_bot_record_test_result(uuid, boolean, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_bot_record_test_result(uuid, boolean, text, text, text) TO service_role;

-- Retorna credenciais completas para edge functions (service_role only)
CREATE OR REPLACE FUNCTION public.crm_bot_get_auth(p_bot_id uuid)
RETURNS TABLE(
  bot_key text,
  identificador_externo text,
  auth_format text,
  environment text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    public.crm_bot_get_key(p_bot_id) AS bot_key,
    b.identificador_externo,
    b.auth_format,
    b.environment
  FROM public.crm_bots b
  WHERE b.id = p_bot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_bot_get_auth(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_bot_get_auth(uuid) TO service_role;