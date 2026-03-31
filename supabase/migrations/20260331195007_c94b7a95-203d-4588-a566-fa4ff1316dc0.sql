
-- contas_bancarias: restringir SELECT a módulo financeiro
DROP POLICY IF EXISTS "authenticated_select_contas_bancarias" ON contas_bancarias;
CREATE POLICY "contas_bancarias_select_financeiro" ON contas_bancarias FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.check_user_access(auth.uid(), 'financeiro')
  );
