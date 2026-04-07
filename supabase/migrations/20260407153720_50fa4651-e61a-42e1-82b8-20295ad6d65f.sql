CREATE OR REPLACE FUNCTION public.decrypt_token(p_encrypted BYTEA)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_key TEXT; v_old_key TEXT;
BEGIN
  IF p_encrypted IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_key 
    FROM vault.decrypted_secrets 
    WHERE name = 'oauth_encryption_key' LIMIT 1;
  IF v_key IS NULL THEN 
    RAISE EXCEPTION 'oauth_encryption_key not found in Vault';
  END IF;
  BEGIN
    RETURN extensions.pgp_sym_decrypt(p_encrypted, v_key);
  EXCEPTION WHEN OTHERS THEN
    v_old_key := current_setting('app.settings.service_role_key', true);
    IF v_old_key IS NOT NULL AND v_old_key != '' THEN
      BEGIN
        RETURN extensions.pgp_sym_decrypt(p_encrypted, v_old_key);
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to decrypt with both Vault and legacy keys';
      END;
    END IF;
    RAISE;
  END;
END;
$$;