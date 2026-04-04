
-- Fix Security Definer Views
ALTER VIEW social_media_credentials_safe SET (security_invoker = on);
ALTER VIEW secrets_expiring_soon SET (security_invoker = on);

-- Fix ads_accounts_safe if it exists
DO $$ BEGIN
  ALTER VIEW ads_accounts_safe SET (security_invoker = on);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Move pgcrypto to extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Drop residual permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage mappings" ON plano_contas_mapeamento_categorias;
