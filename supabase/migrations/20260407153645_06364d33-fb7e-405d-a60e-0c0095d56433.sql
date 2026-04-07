CREATE OR REPLACE FUNCTION public.encrypt_token(p_token TEXT)
RETURNS BYTEA
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_key TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_key 
    FROM vault.decrypted_secrets 
    WHERE name = 'oauth_encryption_key' LIMIT 1;
  IF v_key IS NULL THEN 
    RAISE EXCEPTION 'oauth_encryption_key not found in Vault';
  END IF;
  RETURN extensions.pgp_sym_encrypt(p_token, v_key);
END;
$$;