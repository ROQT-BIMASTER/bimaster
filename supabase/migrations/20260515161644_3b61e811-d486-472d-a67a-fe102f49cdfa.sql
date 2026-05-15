-- Substitui o gate de UPDATE em fabrica_ficha_custo_revisoes por uma versão
-- híbrida: admin OR supervisor OR módulo Fábrica. Mantém Diretoria/Supervisão
-- como sempre tiveram, e libera operadores Fábrica que já podiam atualizar
-- fabrica_produto_custos_config (sem isso a aprovação ficava metade aplicada).

DROP POLICY IF EXISTS "Admins can update revisoes" ON public.fabrica_ficha_custo_revisoes;
DROP POLICY IF EXISTS "Fabrica module can update revisoes" ON public.fabrica_ficha_custo_revisoes;

CREATE POLICY "Diretoria, supervisao e fabrica podem atualizar revisoes"
  ON public.fabrica_ficha_custo_revisoes
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    OR public.can_access_fabrica(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    OR public.can_access_fabrica(auth.uid())
  );