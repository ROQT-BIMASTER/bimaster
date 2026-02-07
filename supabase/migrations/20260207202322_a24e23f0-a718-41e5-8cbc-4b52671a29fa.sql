
-- =====================================================
-- MIGRAÇÃO DE SEGURANÇA CONSOLIDADA
-- =====================================================

-- ===========================================
-- CORREÇÃO 1: Ads Accounts - Remover policy conflitante
-- ===========================================
-- A policy ads_accounts_select_strict anula a ads_accounts_no_direct_select (USING(false))
-- porque no PostgreSQL múltiplas policies SELECT são combinadas com OR.
-- Removendo a permissiva, apenas USING(false) permanece, forçando uso da view segura.
DROP POLICY IF EXISTS ads_accounts_select_strict ON ads_accounts;

-- ===========================================
-- CORREÇÃO 2: Financial Payment Queue - Restringir acesso
-- ===========================================
-- Remover policy ampla que incluía is_admin_or_supervisor() e user_has_empresa_access()
DROP POLICY IF EXISTS fpq_select_policy ON financial_payment_queue;

-- Criar policy restritiva: apenas admin, financeiro ou quem solicitou
CREATE POLICY fpq_select_policy ON financial_payment_queue
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    can_access_payment_queue(auth.uid()) OR
    requested_by = auth.uid()
  );

-- ===========================================
-- CORREÇÃO 3: Mover extensão unaccent para schema extensions
-- ===========================================
ALTER EXTENSION unaccent SET SCHEMA extensions;

-- Criar wrapper no schema public para manter compatibilidade com funções existentes
-- que referenciam public.unaccent() ou unaccent() sem qualificação
CREATE OR REPLACE FUNCTION public.unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT PARALLEL SAFE
SET search_path = extensions
AS $$
  SELECT extensions.unaccent($1);
$$;

-- ===========================================
-- CORREÇÃO 4: Audit Logs - Tornar append-only
-- ===========================================

-- audit_logs: bloquear UPDATE para não-admins
CREATE POLICY audit_logs_no_update ON audit_logs
  FOR UPDATE TO authenticated 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- audit_logs: bloquear DELETE para não-admins
CREATE POLICY audit_logs_no_delete ON audit_logs
  FOR DELETE TO authenticated 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- sensitive_data_access_log: bloquear UPDATE para não-admins
CREATE POLICY sensitive_log_no_update ON sensitive_data_access_log
  FOR UPDATE TO authenticated 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- sensitive_data_access_log: bloquear DELETE para não-admins
CREATE POLICY sensitive_log_no_delete ON sensitive_data_access_log
  FOR DELETE TO authenticated 
  USING (has_role(auth.uid(), 'admin'::app_role));
