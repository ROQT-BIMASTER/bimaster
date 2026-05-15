-- Alinha a policy de UPDATE em fabrica_ficha_custo_revisoes ao mesmo gate
-- já usado em fabrica_produto_custos_config (can_access_fabrica).
--
-- Sem essa correção a aprovação na tela de Revisão de Fichas era bloqueada
-- silenciosamente por RLS para usuários do módulo Fábrica que não fossem
-- admin/supervisor: o UPDATE em fabrica_produto_custos_config passava (e o
-- status aparecia em Produto Acabado) enquanto o UPDATE em
-- fabrica_ficha_custo_revisoes não tinha efeito, deixando a ficha como
-- "pendente" na própria tela de Revisão.

DROP POLICY IF EXISTS "Admins can update revisoes" ON public.fabrica_ficha_custo_revisoes;

CREATE POLICY "Fabrica module can update revisoes"
  ON public.fabrica_ficha_custo_revisoes
  FOR UPDATE
  TO authenticated
  USING (public.can_access_fabrica(auth.uid()))
  WITH CHECK (public.can_access_fabrica(auth.uid()));
