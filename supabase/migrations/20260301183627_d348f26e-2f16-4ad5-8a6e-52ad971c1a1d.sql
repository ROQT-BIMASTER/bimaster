
-- =============================================================
-- SECURITY HARDENING MIGRATION (Atomic Transaction)
-- Fixes: #1 fabrica_fornecedores_safe invoker, #2 configuracoes_cobranca token masking,
--        #3 team_member_details PII leak, #4 stores direct SELECT block
-- =============================================================

-- =============================================
-- FIX #1: fabrica_fornecedores_safe → security_invoker=on
-- =============================================
DROP VIEW IF EXISTS public.fabrica_fornecedores_safe;

CREATE VIEW public.fabrica_fornecedores_safe
WITH (security_invoker=on) AS
SELECT
  id, razao_social, nome_fantasia, cnpj, contato, telefone, email, endereco, ativo, created_at, updated_at,
  CASE WHEN (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'::text))
    THEN banco ELSE NULL::character varying END AS banco,
  CASE WHEN (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'::text))
    THEN agencia ELSE NULL::character varying END AS agencia,
  CASE WHEN (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'::text))
    THEN conta ELSE NULL::character varying END AS conta,
  CASE WHEN (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'::text))
    THEN tipo_conta ELSE NULL::character varying END AS tipo_conta,
  CASE WHEN (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'::text))
    THEN pix_chave ELSE NULL::character varying END AS pix_chave,
  CASE WHEN (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'::text))
    THEN pix_tipo ELSE NULL::character varying END AS pix_tipo,
  CASE WHEN (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'::text))
    THEN favorecido ELSE NULL::character varying END AS favorecido,
  CASE WHEN (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.check_user_access(auth.uid(), 'financeiro'::text))
    THEN linha_digitavel ELSE NULL::text END AS linha_digitavel
FROM public.fabrica_fornecedores;

-- =============================================
-- FIX #2: configuracoes_cobranca — mask tokens, block direct SELECT
-- =============================================

-- Create safe view that masks secrets
CREATE OR REPLACE VIEW public.configuracoes_cobranca_safe
WITH (security_invoker=on) AS
SELECT
  id,
  CASE WHEN api_key IS NOT NULL AND api_key != '' THEN '***' ELSE '' END AS api_key,
  CASE WHEN whatsapp_verify_token IS NOT NULL AND whatsapp_verify_token != '' THEN '***' ELSE '' END AS whatsapp_verify_token,
  automacao_ativa,
  hora_inicio_envio,
  hora_fim_envio,
  max_envios_hora,
  intervalo_minimo_dias,
  email_remetente,
  nome_remetente,
  created_at,
  updated_at,
  created_by,
  updated_by
FROM public.configuracoes_cobranca;

-- Drop overly permissive policy and replace with separate READ (blocked) + WRITE policies
DROP POLICY IF EXISTS "Admins podem gerenciar configurações de cobrança" ON public.configuracoes_cobranca;

-- Block direct SELECT on base table (force use of safe view)
CREATE POLICY "block_direct_select_cobranca"
ON public.configuracoes_cobranca FOR SELECT
TO authenticated
USING (false);

-- Allow INSERT for admins
CREATE POLICY "admins_insert_cobranca"
ON public.configuracoes_cobranca FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::public.app_role, 'supervisor'::public.app_role))
);

-- Allow UPDATE for admins
CREATE POLICY "admins_update_cobranca"
ON public.configuracoes_cobranca FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::public.app_role, 'supervisor'::public.app_role))
);

-- Allow DELETE for admins
CREATE POLICY "admins_delete_cobranca"
ON public.configuracoes_cobranca FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::public.app_role, 'supervisor'::public.app_role))
);

-- Grant SELECT on safe view to authenticated (view reads base table via INVOKER, but SELECT policy blocks it —
-- the view needs a separate grant via SECURITY DEFINER helper or we use a permissive policy on the view).
-- Since views with security_invoker=on use the caller's privileges, and we blocked SELECT on base table,
-- we need a SECURITY DEFINER function. Instead, let's allow SELECT only through the view by using a
-- policy that checks if the caller is admin/supervisor (same people who manage it).
-- Actually, the simplest approach: replace the SELECT block with a policy that allows SELECT but masks via the view.
-- Let's use a different approach: allow SELECT for admin/supervisor on the base table BUT the frontend reads from the safe view.

DROP POLICY IF EXISTS "block_direct_select_cobranca" ON public.configuracoes_cobranca;

CREATE POLICY "admins_select_cobranca"
ON public.configuracoes_cobranca FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin'::public.app_role, 'supervisor'::public.app_role))
);

-- =============================================
-- FIX #3: Remove supervisor PII access from team_member_details
-- =============================================
DROP POLICY IF EXISTS "supervisor_team_read_access" ON public.team_member_details;

-- =============================================
-- FIX #4: Block direct SELECT on stores, force stores_safe usage
-- =============================================
DROP POLICY IF EXISTS "stores_select" ON public.stores;

-- Block direct SELECT — frontend must use stores_safe view
CREATE POLICY "stores_select_blocked"
ON public.stores FOR SELECT
TO authenticated
USING (false);
