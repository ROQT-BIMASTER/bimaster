
DROP POLICY "Authenticated users can insert projeto_produto_vinculos" ON public.projeto_produto_vinculos;
DROP POLICY "Authenticated users can delete projeto_produto_vinculos" ON public.projeto_produto_vinculos;

CREATE POLICY "Members can insert projeto_produto_vinculos"
  ON public.projeto_produto_vinculos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can delete projeto_produto_vinculos"
  ON public.projeto_produto_vinculos FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM public.projeto_membros pm
    WHERE pm.projeto_id = projeto_produto_vinculos.projeto_id
      AND pm.user_id = auth.uid()
      AND pm.papel IN ('coordenador', 'gestor_produto')
  ));
