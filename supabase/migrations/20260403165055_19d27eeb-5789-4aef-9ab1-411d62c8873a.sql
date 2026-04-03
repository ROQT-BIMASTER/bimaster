
-- 1. Drop existing slow RLS policies
DROP POLICY IF EXISTS cr_select_empresa ON contas_receber;
DROP POLICY IF EXISTS cr_deny_anon ON contas_receber;

-- 2. Create optimized RLS policy using semi-join instead of per-row function calls
CREATE POLICY cr_select_empresa ON contas_receber
FOR SELECT TO authenticated
USING (
  empresa_id IN (SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- 3. Grant SELECT on user_roles to authenticated (needed by has_role function)
GRANT SELECT ON public.user_roles TO authenticated;

-- 4. Composite index for the main query pattern
CREATE INDEX IF NOT EXISTS idx_cr_empresa_vencimento 
ON contas_receber (empresa_id, data_vencimento DESC);
