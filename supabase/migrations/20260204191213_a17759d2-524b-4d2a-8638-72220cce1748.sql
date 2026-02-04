
-- Corrigir view ads_accounts_safe adicionando security_invoker=on
DROP VIEW IF EXISTS ads_accounts_safe;

CREATE VIEW ads_accounts_safe 
WITH (security_invoker=on)
AS
SELECT 
  id,
  user_id,
  platform,
  account_id,
  account_name,
  is_active,
  sync_status,
  last_sync_at,
  created_at,
  updated_at
FROM ads_accounts;

COMMENT ON VIEW ads_accounts_safe IS 'View segura que expõe dados de ads_accounts sem credentials_encrypted. Usa security_invoker para respeitar RLS do usuário.';
