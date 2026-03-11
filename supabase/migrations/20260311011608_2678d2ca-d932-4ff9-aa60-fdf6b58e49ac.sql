
DROP POLICY IF EXISTS "cp_select" ON public.contas_pagar;
CREATE POLICY "cp_select_empresa" ON public.contas_pagar
FOR SELECT TO authenticated
USING (
  public.check_user_access(auth.uid(), 'financeiro')
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

DROP POLICY IF EXISTS "cp_insert" ON public.contas_pagar;
CREATE POLICY "cp_insert_empresa" ON public.contas_pagar
FOR INSERT TO authenticated
WITH CHECK (
  public.check_user_access(auth.uid(), 'financeiro')
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);

DROP POLICY IF EXISTS "cp_update" ON public.contas_pagar;
CREATE POLICY "cp_update_empresa" ON public.contas_pagar
FOR UPDATE TO authenticated
USING (
  public.check_user_access(auth.uid(), 'financeiro')
  AND public.user_has_empresa_access(auth.uid(), empresa_id)
);
