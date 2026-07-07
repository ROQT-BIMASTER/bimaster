
-- Broaden pagamentos_caixa SELECT to match contas_pagar (financeiro role + empresa access).
DROP POLICY IF EXISTS pagamentos_caixa_select_authorized ON public.pagamentos_caixa;

CREATE POLICY pagamentos_caixa_select_financeiro
  ON public.pagamentos_caixa
  FOR SELECT
  TO authenticated
  USING (
    check_user_access((SELECT auth.uid()), 'financeiro'::text)
    AND (empresa_id IS NULL OR user_has_empresa_access((SELECT auth.uid()), empresa_id))
  );
