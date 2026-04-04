
-- 1. Gerar chave dedicada no Vault
SELECT vault.create_secret(
  encode(gen_random_bytes(32), 'hex'),
  'oauth_encryption_key',
  'Chave dedicada para criptografia de tokens OAuth'
);

-- 2. Refatorar encrypt_token para usar Vault
CREATE OR REPLACE FUNCTION encrypt_token(p_token TEXT)
RETURNS BYTEA LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_key TEXT;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_key 
    FROM vault.decrypted_secrets 
    WHERE name = 'oauth_encryption_key' LIMIT 1;
  IF v_key IS NULL THEN 
    RAISE EXCEPTION 'oauth_encryption_key not found in Vault';
  END IF;
  RETURN pgp_sym_encrypt(p_token, v_key);
END;
$$;

-- 3. Refatorar decrypt_token para usar Vault com fallback
CREATE OR REPLACE FUNCTION decrypt_token(p_encrypted BYTEA)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    RETURN pgp_sym_decrypt(p_encrypted, v_key);
  EXCEPTION WHEN OTHERS THEN
    v_old_key := current_setting('app.settings.service_role_key', true);
    IF v_old_key IS NOT NULL AND v_old_key != '' THEN
      BEGIN
        RETURN pgp_sym_decrypt(p_encrypted, v_old_key);
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to decrypt with both Vault and legacy keys';
      END;
    END IF;
    RAISE;
  END;
END;
$$;

-- 4. Dropar view dependente ANTES de alterar a tabela
DROP VIEW IF EXISTS social_media_accounts_safe;

-- 5. Adicionar coluna encrypted
ALTER TABLE social_media_accounts 
ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA;

-- 6. Migrar tokens plaintext para encrypted
UPDATE social_media_accounts
SET access_token_encrypted = encrypt_token(access_token)
WHERE access_token IS NOT NULL AND access_token != '' AND access_token_encrypted IS NULL;

-- 7. Dropar coluna plaintext
ALTER TABLE social_media_accounts DROP COLUMN IF EXISTS access_token;

-- 8. Recriar view safe
CREATE OR REPLACE VIEW social_media_accounts_safe WITH (security_invoker = on) AS
SELECT id, platform, username, account_name, account_group, region, status, 
       error_message, last_sync_at, user_id, created_at, updated_at,
       (access_token_encrypted IS NOT NULL) AS has_token
FROM social_media_accounts;

-- 9. Re-criptografar tokens em social_media_credentials com chave Vault
UPDATE social_media_credentials
SET access_token_encrypted = encrypt_token(decrypt_token(access_token_encrypted::bytea)),
    refresh_token_encrypted = encrypt_token(decrypt_token(refresh_token_encrypted::bytea))
WHERE access_token_encrypted IS NOT NULL;

-- 10. Re-criptografar tokens em ads_accounts com chave Vault
UPDATE ads_accounts
SET credentials_enc = encrypt_token(decrypt_token(credentials_enc::bytea))
WHERE credentials_enc IS NOT NULL;
