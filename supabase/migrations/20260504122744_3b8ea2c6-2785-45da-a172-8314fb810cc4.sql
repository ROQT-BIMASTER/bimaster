-- Fix EXPOSED_COST_FORMULA_DATA: substituir SELECT 'true' por checagem de módulo Fábrica
DROP POLICY IF EXISTS "Authenticated users can view ficha custo config" ON public.fabrica_ficha_custo_config;
CREATE POLICY "Fabrica module can view ficha custo config"
  ON public.fabrica_ficha_custo_config
  FOR SELECT TO authenticated
  USING (public.can_access_fabrica(auth.uid()));

DROP POLICY IF EXISTS "Usuários autenticados podem ver config de custos" ON public.fabrica_produto_custos_config;
-- a policy 'fabrica_config_select_restricted' já cobre o acesso correto

DROP POLICY IF EXISTS "Authenticated users can view revisoes" ON public.fabrica_ficha_custo_revisoes;
CREATE POLICY "Fabrica module can view revisoes"
  ON public.fabrica_ficha_custo_revisoes
  FOR SELECT TO authenticated
  USING (public.can_access_fabrica(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view revisao_itens" ON public.fabrica_ficha_custo_revisao_itens;
CREATE POLICY "Fabrica module can view revisao_itens"
  ON public.fabrica_ficha_custo_revisao_itens
  FOR SELECT TO authenticated
  USING (public.can_access_fabrica(auth.uid()));

-- Fix EXPOSED_FINANCIAL_COST_DATA: china_oc_custos
DROP POLICY IF EXISTS "auth view china_oc_custos" ON public.china_oc_custos;
CREATE POLICY "China or finance module can view oc custos"
  ON public.china_oc_custos
  FOR SELECT TO authenticated
  USING (
    public.check_user_access(auth.uid(), 'china')
    OR public.check_user_access(auth.uid(), 'financeiro')
    OR public.is_admin_or_supervisor(auth.uid())
  );

-- Fix BROAD_OPERATIONAL_DATA_ACCESS: china_ordens_compra
DROP POLICY IF EXISTS "Authenticated users can view china_ordens_compra" ON public.china_ordens_compra;
CREATE POLICY "China module can view ordens compra"
  ON public.china_ordens_compra
  FOR SELECT TO authenticated
  USING (
    public.check_user_access(auth.uid(), 'china')
    OR public.is_admin_or_supervisor(auth.uid())
  );

-- Fix BROAD_OPERATIONAL_DATA_ACCESS: processo_tarefa_espelho — limitar a membros do projeto
DROP POLICY IF EXISTS "Autenticados leem espelhos" ON public.processo_tarefa_espelho;
CREATE POLICY "Project members can read espelhos"
  ON public.processo_tarefa_espelho
  FOR SELECT TO authenticated
  USING (
    public.is_admin_or_supervisor(auth.uid())
    OR (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id))
    OR created_by = auth.uid()
    OR acao_solicitada_por = auth.uid()
    OR concluida_por = auth.uid()
  );