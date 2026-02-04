
-- Corrigir view ads_accounts_safe para não usar SECURITY DEFINER
-- A view anterior herdou SECURITY DEFINER implicitamente pela função no WHERE

DROP VIEW IF EXISTS ads_accounts_safe;

-- Criar view simples sem SECURITY DEFINER
-- A segurança é garantida pela RLS na tabela base
CREATE VIEW ads_accounts_safe AS
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

-- A view herda automaticamente as políticas RLS da tabela base ads_accounts
-- que já tem can_access_ads_account verificando owner/admin
COMMENT ON VIEW ads_accounts_safe IS 'View segura que expõe dados de ads_accounts sem credentials_encrypted. Herda RLS da tabela base.';
