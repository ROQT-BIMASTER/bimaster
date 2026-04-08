
-- Fix boletos: replace permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view boletos" ON public.boletos;
CREATE POLICY "Users can view boletos of their companies"
  ON public.boletos
  FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
    )
  );

-- Fix orcamentos_caixa: replace permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read orcamentos_caixa" ON public.orcamentos_caixa;
CREATE POLICY "Users can read orcamentos_caixa of their companies"
  ON public.orcamentos_caixa
  FOR SELECT
  TO authenticated
  USING (
    empresa_id IN (
      SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = auth.uid()
    )
  );
