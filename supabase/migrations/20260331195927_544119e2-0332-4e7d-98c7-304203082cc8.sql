
-- ============================================================
-- DROP + RECREATE VIEWS AS SECURITY INVOKER
-- ============================================================

-- 1. profiles_safe
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe
WITH (security_invoker = true) AS
SELECT id, nome, status, aprovado, departamento_id, supervisor_id, gerente_id, created_at, updated_at,
  CASE
    WHEN (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'supervisor'::app_role)) THEN email
    ELSE concat(left(email, 3), '***@', right(email, 4))
  END AS email
FROM profiles;

-- 2. stores_safe
DROP VIEW IF EXISTS public.stores_safe;
CREATE VIEW public.stores_safe
WITH (security_invoker = true) AS
SELECT id, code, name, chain, cnpj, address, city, state, zip_code, latitude, longitude,
  phone, email, category, size, monthly_revenue, visit_frequency, priority, status,
  manager_name, manager_phone, notes, created_by, created_at, updated_at, vendedor_id, supervisor_id,
  branch_count, classification, situacao_cadastral, porte_empresa, regime_tributario,
  matriz_filial, capital_social, cnae_principal,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN banco ELSE NULL::text END AS banco,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN agencia ELSE NULL::text END AS agencia,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN conta ELSE NULL::text END AS conta,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN tipo_conta ELSE NULL::text END AS tipo_conta,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN pix_chave ELSE NULL::text END AS pix_chave,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN pix_tipo ELSE NULL::text END AS pix_tipo,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN favorecido ELSE NULL::text END AS favorecido,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN linha_digitavel ELSE NULL::text END AS linha_digitavel
FROM stores;

-- 3. team_member_details_safe
DROP VIEW IF EXISTS public.team_member_details_safe;
CREATE VIEW public.team_member_details_safe
WITH (security_invoker = true) AS
SELECT id, user_id, nome_completo,
  CASE WHEN has_role(auth.uid(), 'admin') THEN cpf
       WHEN cpf IS NOT NULL THEN ('***.' || right(cpf, 2))
       ELSE NULL::text END AS cpf,
  CASE WHEN has_role(auth.uid(), 'admin') THEN rg
       WHEN rg IS NOT NULL THEN ('***' || right(rg, 2))
       ELSE NULL::text END AS rg,
  CASE WHEN has_role(auth.uid(), 'admin') THEN data_nascimento
       ELSE NULL::date END AS data_nascimento,
  email_pessoal, whatsapp, tamanho_camiseta, equipe_comercial, supervisor_nome,
  observacoes, created_at, updated_at, created_by
FROM team_member_details;

-- 4. fabrica_fornecedores_safe
DROP VIEW IF EXISTS public.fabrica_fornecedores_safe;
CREATE VIEW public.fabrica_fornecedores_safe
WITH (security_invoker = true) AS
SELECT id, razao_social, nome_fantasia, cnpj, contato, telefone, email, endereco,
  ativo, created_at, updated_at,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN banco ELSE NULL::character varying END AS banco,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN agencia ELSE NULL::character varying END AS agencia,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN conta ELSE NULL::character varying END AS conta,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN tipo_conta ELSE NULL::character varying END AS tipo_conta,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN pix_chave ELSE NULL::character varying END AS pix_chave,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN pix_tipo ELSE NULL::character varying END AS pix_tipo,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN favorecido ELSE NULL::character varying END AS favorecido,
  CASE WHEN (has_role(auth.uid(), 'admin') OR check_user_access(auth.uid(), 'financeiro')) THEN linha_digitavel ELSE NULL::character varying END AS linha_digitavel
FROM fabrica_fornecedores;

-- 5. stores_with_sellers
DROP VIEW IF EXISTS public.stores_with_sellers;
CREATE VIEW public.stores_with_sellers
WITH (security_invoker = true) AS
SELECT s.id, s.code, s.name, s.chain, s.cnpj, s.address, s.city, s.state, s.zip_code,
  s.latitude, s.longitude, s.phone, s.email, s.category, s.size, s.monthly_revenue,
  s.visit_frequency, s.priority, s.status, s.manager_name, s.manager_phone, s.notes,
  s.created_by, s.created_at, s.updated_at, s.vendedor_id, s.supervisor_id,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ss.id, 'vendedor_id', ss.vendedor_id, 'is_principal', ss.is_principal, 'vendedor_nome', p.nome, 'vendedor_email', p.email))
    FROM store_sellers ss LEFT JOIN profiles p ON ss.vendedor_id = p.id
    WHERE ss.store_id = s.id), '[]'::jsonb) AS vendedores,
  (SELECT ss.vendedor_id FROM store_sellers ss WHERE ss.store_id = s.id AND ss.is_principal = true LIMIT 1) AS vendedor_principal_id
FROM stores s;

-- 6. erp_config_safe
DROP VIEW IF EXISTS public.erp_config_safe;
CREATE VIEW public.erp_config_safe
WITH (security_invoker = true) AS
SELECT id, empresa_id, config_key, config_value, description, is_secret, ativo, updated_at, updated_by
FROM erp_config
WHERE config_key <> 'api_key';

-- 7. ads_accounts_safe
DROP VIEW IF EXISTS public.ads_accounts_safe;
CREATE VIEW public.ads_accounts_safe
WITH (security_invoker = true) AS
SELECT id, user_id, platform, account_id, account_name, is_active, sync_status, last_sync_at, created_at, updated_at
FROM ads_accounts;

-- ============================================================
-- STORAGE: Remove duplicate trade-photos INSERT policies
-- ============================================================
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuários trade podem fazer upload de fotos" ON storage.objects;

-- ============================================================
-- STORAGE: china-pasta-digital — add path ownership
-- ============================================================
DROP POLICY IF EXISTS "Auth users can read china-pasta-digital" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload to china-pasta-digital" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete china-pasta-digital" ON storage.objects;

CREATE POLICY "china_pasta_digital_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'china-pasta-digital' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.check_user_access(auth.uid(), 'fabrica_china')
  ));

CREATE POLICY "china_pasta_digital_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'china-pasta-digital' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  ));

CREATE POLICY "china_pasta_digital_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'china-pasta-digital' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_supervisor(auth.uid())
  ));
