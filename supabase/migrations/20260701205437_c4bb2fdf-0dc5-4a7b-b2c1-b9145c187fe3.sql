
-- ============ CHINA TABLES ============
DROP POLICY IF EXISTS china_doc_historico_select ON public.china_produto_documentos_historico;
CREATE POLICY china_doc_historico_select ON public.china_produto_documentos_historico
  FOR SELECT TO authenticated
  USING (public.user_can_access_china_submissao(submissao_id, auth.uid()));

DROP POLICY IF EXISTS checklist_select ON public.china_produto_checklist;
CREATE POLICY checklist_select ON public.china_produto_checklist
  FOR SELECT TO authenticated
  USING (public.user_can_access_china_submissao(submissao_id, auth.uid()));

DROP POLICY IF EXISTS china_cores_select ON public.china_produto_cores;
CREATE POLICY china_cores_select ON public.china_produto_cores
  FOR SELECT TO authenticated
  USING (public.user_can_access_china_submissao(submissao_id, auth.uid()));

-- ============ FLUXO APROVACAO ============
-- Helper: access to a fluxo instance = admin/supervisor, creator, briefing owner, or project member of the linked task/project
CREATE OR REPLACE FUNCTION public.can_access_fluxo_instancia(_instancia_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fluxo_aprovacao_instancias fai
    LEFT JOIN public.projeto_tarefas pt ON pt.id = fai.tarefa_id
    WHERE fai.id = _instancia_id
      AND (
        fai.created_by = _user_id
        OR public.has_role(_user_id, 'admin'::app_role)
        OR public.has_role(_user_id, 'supervisor'::app_role)
        OR (fai.projeto_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.projeto_membros pm
              WHERE pm.projeto_id = fai.projeto_id AND pm.user_id = _user_id))
        OR (pt.projeto_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.projeto_membros pm
              WHERE pm.projeto_id = pt.projeto_id AND pm.user_id = _user_id))
        OR (fai.briefing_id IS NOT NULL AND public.can_access_briefing(fai.briefing_id, _user_id))
        OR (fai.submissao_id IS NOT NULL AND public.user_can_access_china_submissao(fai.submissao_id, _user_id))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_fluxo_instancia(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_fluxo_instancia(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated can read transitions" ON public.fluxo_aprovacao_transicoes;
CREATE POLICY "fat_select" ON public.fluxo_aprovacao_transicoes
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.can_access_fluxo_instancia(instancia_id, auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated can select vinculos" ON public.fluxo_aprovacao_vinculos;
CREATE POLICY "fav_select" ON public.fluxo_aprovacao_vinculos
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.can_access_fluxo_instancia(instancia_id, auth.uid())
  );

-- Tighten fluxo_aprovacao_etapa_eventos: keep participants + use unified access helper
DROP POLICY IF EXISTS faee_select ON public.fluxo_aprovacao_etapa_eventos;
CREATE POLICY faee_select ON public.fluxo_aprovacao_etapa_eventos
  FOR SELECT TO authenticated
  USING (
    responsavel_id = auth.uid()
    OR decidido_por = auth.uid()
    OR public.can_access_fluxo_instancia(instancia_id, auth.uid())
  );
