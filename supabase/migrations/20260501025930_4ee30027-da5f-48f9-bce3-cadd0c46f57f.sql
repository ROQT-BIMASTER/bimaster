-- Função SECURITY DEFINER usada pelo secure-handler para validar step-up tokens
CREATE OR REPLACE FUNCTION public.mfa_step_up_validate(
  _user_id uuid,
  _scope text,
  _token text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp, extensions
AS $$
DECLARE
  _hash text;
  _row record;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN RETURN false; END IF;
  _hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  SELECT * INTO _row FROM public.mfa_step_up_tokens
  WHERE user_id = _user_id
    AND scope = _scope
    AND token_hash = _hash
    AND consumed = false
    AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.mfa_step_up_tokens SET consumed = true WHERE id = _row.id;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mfa_step_up_validate(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mfa_step_up_validate(uuid, text, text) TO service_role;