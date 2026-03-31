
-- Fix social_media_accounts_safe — still has access_token column
DROP VIEW IF EXISTS public.social_media_accounts_safe;
CREATE VIEW public.social_media_accounts_safe
WITH (security_invoker = true) AS
SELECT 
  id, user_id, platform, account_name, username,
  (access_token IS NOT NULL AND access_token <> '') AS has_access_token,
  status, created_at, updated_at, last_sync_at
FROM social_media_accounts;

-- Fix stores_with_sellers — remove banking columns
DROP VIEW IF EXISTS public.stores_with_sellers;
CREATE VIEW public.stores_with_sellers
WITH (security_invoker = true) AS
SELECT 
  s.id, s.code, s.name, s.chain, s.cnpj, s.address, s.city, s.state, s.zip_code,
  s.latitude, s.longitude, s.phone, s.email, s.category, s.size,
  s.monthly_revenue, s.visit_frequency, s.priority, s.status,
  s.manager_name, s.manager_phone, s.notes,
  s.created_by, s.created_at, s.updated_at,
  s.vendedor_id, s.supervisor_id, s.branch_count, s.classification,
  s.situacao_cadastral, s.porte_empresa, s.regime_tributario,
  s.matriz_filial, s.capital_social, s.cnae_principal,
  p.nome AS vendedor_nome,
  p.email AS vendedor_email
FROM stores s
LEFT JOIN profiles p ON p.id = s.vendedor_id;
