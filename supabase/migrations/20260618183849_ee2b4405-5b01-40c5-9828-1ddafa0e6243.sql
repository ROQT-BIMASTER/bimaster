DROP POLICY IF EXISTS china_sub_select ON public.china_produto_submissoes;
DROP POLICY IF EXISTS china_sub_update ON public.china_produto_submissoes;

CREATE POLICY china_sub_select ON public.china_produto_submissoes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY china_sub_update ON public.china_produto_submissoes
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);