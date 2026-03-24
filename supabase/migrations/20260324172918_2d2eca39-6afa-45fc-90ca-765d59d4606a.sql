-- Replace overly permissive "Acesso total autenticado" ALL policies on 6 financial tables
-- with role-scoped policies: admin/supervisor/gerente get full access, others read-only

-- Helper: check if user has financial management role
CREATE OR REPLACE FUNCTION public.has_financial_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'supervisor'::app_role, 'gerente'::app_role)
  )
$$;

-- ============ centros_custo ============
DROP POLICY IF EXISTS "Acesso total autenticado" ON public.centros_custo;
CREATE POLICY "authenticated_select_centros_custo" ON public.centros_custo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "financial_role_modify_centros_custo" ON public.centros_custo
  FOR ALL TO authenticated
  USING (has_financial_role(auth.uid()))
  WITH CHECK (has_financial_role(auth.uid()));

-- ============ contas_bancarias ============
DROP POLICY IF EXISTS "Acesso total autenticado" ON public.contas_bancarias;
CREATE POLICY "authenticated_select_contas_bancarias" ON public.contas_bancarias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "financial_role_modify_contas_bancarias" ON public.contas_bancarias
  FOR ALL TO authenticated
  USING (has_financial_role(auth.uid()))
  WITH CHECK (has_financial_role(auth.uid()));

-- ============ fornecedores ============
DROP POLICY IF EXISTS "Acesso total autenticado" ON public.fornecedores;
CREATE POLICY "authenticated_select_fornecedores" ON public.fornecedores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "financial_role_modify_fornecedores" ON public.fornecedores
  FOR ALL TO authenticated
  USING (has_financial_role(auth.uid()))
  WITH CHECK (has_financial_role(auth.uid()));

-- ============ pagamentos ============
DROP POLICY IF EXISTS "Acesso total autenticado" ON public.pagamentos;
CREATE POLICY "authenticated_select_pagamentos" ON public.pagamentos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "financial_role_modify_pagamentos" ON public.pagamentos
  FOR ALL TO authenticated
  USING (has_financial_role(auth.uid()))
  WITH CHECK (has_financial_role(auth.uid()));

-- ============ parcelas ============
DROP POLICY IF EXISTS "Acesso total autenticado" ON public.parcelas;
CREATE POLICY "authenticated_select_parcelas" ON public.parcelas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "financial_role_modify_parcelas" ON public.parcelas
  FOR ALL TO authenticated
  USING (has_financial_role(auth.uid()))
  WITH CHECK (has_financial_role(auth.uid()));

-- ============ plano_contas ============
DROP POLICY IF EXISTS "Acesso total autenticado" ON public.plano_contas;
CREATE POLICY "authenticated_select_plano_contas" ON public.plano_contas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "financial_role_modify_plano_contas" ON public.plano_contas
  FOR ALL TO authenticated
  USING (has_financial_role(auth.uid()))
  WITH CHECK (has_financial_role(auth.uid()));