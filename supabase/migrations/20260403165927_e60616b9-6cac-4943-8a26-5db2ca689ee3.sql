-- Grant SELECT on user_roles to authenticated (required for has_role function used in RLS policies)
GRANT SELECT ON public.user_roles TO authenticated;

-- Ensure the optimized RLS policy exists on contas_receber
DROP POLICY IF EXISTS cr_select_empresa ON contas_receber;
DROP POLICY IF EXISTS cr_deny_anon ON contas_receber;

CREATE POLICY cr_select_empresa ON contas_receber
FOR SELECT TO authenticated
USING (
  empresa_id IN (SELECT empresa_id FROM public.user_empresas WHERE user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- Composite index for main query pattern
CREATE INDEX IF NOT EXISTS idx_cr_empresa_vencimento 
ON contas_receber (empresa_id, data_vencimento DESC);