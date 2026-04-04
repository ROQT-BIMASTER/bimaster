

# Vault Dedicado + Integração OAuth nos Edge Functions — Nota 10/10

## O Que Será Feito

### 1. Chave de Criptografia Dedicada no Vault (migração)

Atualmente, `encrypt_token()` e `decrypt_token()` usam `current_setting('app.settings.service_role_key')` com fallback para uma string fixa (`'default-encryption-key-change-in-production'`). Isso é inseguro porque:
- A service_role_key tem outro propósito (autenticação, não criptografia)
- O fallback hardcoded é previsível

**Ação**: Criar um secret dedicado `oauth_encryption_key` no Vault (via `vault.create_secret`) com uma chave aleatória de 64 caracteres, e refatorar as funções `encrypt_token`/`decrypt_token` para buscar essa chave do Vault em vez do `app.settings`.

```text
ANTES:  encrypt_token → current_setting('app.settings.service_role_key') → fallback string
DEPOIS: encrypt_token → vault.decrypted_secrets('oauth_encryption_key') → erro se ausente
```

### 2. Edge Functions Usando Tokens Decriptados (refatoração)

Atualmente, `social-media-cron` lê `access_token` diretamente da tabela `social_media_accounts` (coluna plaintext que foi removida de `social_media_credentials` mas ainda existe em `social_media_accounts`). Precisa:
- Usar `decrypt_token()` via RPC do service_role client para obter o token antes de chamar as APIs
- Atualizar `social-media-cron/index.ts` para chamar `supabase.rpc('decrypt_token', { p_encrypted: account.access_token_encrypted })`
- Atualizar `social-media-metrics/index.ts` para receber o token já decriptado (sem mudança na interface)

### 3. Re-criptografar Tokens com Chave Vault (migração de dados)

Após criar a chave no Vault, re-criptografar todos os tokens existentes com a nova chave dedicada (em vez da service_role_key usada anteriormente).

## Migrações SQL

### Migração: Vault key + refatoração encrypt/decrypt

```sql
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

-- 3. Refatorar decrypt_token para usar Vault
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
  -- Tentar nova chave, fallback para chave antiga durante migração
  BEGIN
    RETURN pgp_sym_decrypt(p_encrypted, v_key);
  EXCEPTION WHEN OTHERS THEN
    v_old_key := current_setting('app.settings.service_role_key', true);
    IF v_old_key IS NOT NULL THEN
      RETURN pgp_sym_decrypt(p_encrypted, v_old_key);
    END IF;
    RAISE;
  END;
END;
$$;

-- 4. Re-criptografar tokens existentes com nova chave
-- (decrypt com chave antiga, encrypt com chave nova)
UPDATE social_media_credentials
SET access_token_encrypted = encrypt_token(decrypt_token(access_token_encrypted)),
    refresh_token_encrypted = encrypt_token(decrypt_token(refresh_token_encrypted))
WHERE access_token_encrypted IS NOT NULL;

UPDATE ads_accounts
SET credentials_enc = encrypt_token(decrypt_token(credentials_enc))
WHERE credentials_enc IS NOT NULL;
```

## Arquivo Edge Function Alterado

### `supabase/functions/social-media-cron/index.ts`

Refatorar para usar `decrypt_token` via RPC em vez de ler `access_token` plaintext:

```typescript
// ANTES (linha 41):
.select('platform, username, access_token');

// DEPOIS:
.select('platform, username, access_token_encrypted');

// E antes de chamar social-media-metrics:
const { data: decrypted } = await supabase.rpc('decrypt_token', { 
  p_encrypted: account.access_token_encrypted 
});
const token = decrypted;
```

## Verificação de Coluna em social_media_accounts

Verificar se `social_media_accounts` ainda tem coluna `access_token` plaintext. Se sim, migrar para encrypted e dropar a coluna plaintext (mesmo padrão aplicado em `social_media_credentials`).

## Resultado

| Item | Antes | Depois |
|---|---|---|
| Chave de criptografia | Fallback hardcoded | Vault dedicado com chave aleatória |
| Tokens OAuth em trânsito | Plaintext no edge function | Decriptados sob demanda via RPC |
| Score | 9.8 | **10.0** |

