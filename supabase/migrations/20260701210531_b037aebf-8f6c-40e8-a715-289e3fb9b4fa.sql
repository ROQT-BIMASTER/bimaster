
-- 1) Helper: write-side China submissão
CREATE OR REPLACE FUNCTION public.user_can_write_china_submissao(
  _submissao_id uuid,
  _user_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'supervisor'::app_role)
      OR public.check_user_access(_user_id, 'fabrica'::text)
      OR public.check_user_access(_user_id, 'fabrica_china'::text)
      OR public.check_user_access(_user_id, 'china'::text)
      OR EXISTS (
        SELECT 1 FROM public.china_produto_submissoes s
        WHERE s.id = _submissao_id AND s.created_by = _user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.china_submissao_projetos sp
        JOIN public.projeto_membros pm ON pm.projeto_id = sp.projeto_id
        WHERE sp.submissao_id = _submissao_id
          AND pm.user_id = _user_id
      )
    )
$$;

REVOKE ALL ON FUNCTION public.user_can_write_china_submissao(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.user_can_write_china_submissao(uuid, uuid) TO authenticated, service_role;

-- 2) Helper: write-side Fluxo de Aprovação instância
CREATE OR REPLACE FUNCTION public.can_write_fluxo_instancia(
  _instancia_id uuid,
  _user_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'supervisor'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.fluxo_aprovacao_instancias fai
        WHERE fai.id = _instancia_id
          AND (
            fai.created_by = _user_id
            OR (
              fai.tarefa_id IS NOT NULL
              AND EXISTS (
                SELECT 1 FROM public.projeto_tarefas pt
                JOIN public.projeto_membros pm ON pm.projeto_id = pt.projeto_id
                WHERE pt.id = fai.tarefa_id AND pm.user_id = _user_id
              )
            )
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.fluxo_aprovacao_etapa_eventos e
        WHERE e.instancia_id = _instancia_id
          AND (e.responsavel_id = _user_id OR e.decidido_por = _user_id)
      )
    )
$$;

REVOKE ALL ON FUNCTION public.can_write_fluxo_instancia(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_write_fluxo_instancia(uuid, uuid) TO authenticated, service_role;

-- ============================================================
-- CHINA: rewrite ad-hoc write policies using user_can_write_china_submissao
-- ============================================================
DROP POLICY IF EXISTS "checklist_insert" ON public.china_produto_checklist;
DROP POLICY IF EXISTS "checklist_update" ON public.china_produto_checklist;
DROP POLICY IF EXISTS "checklist_delete" ON public.china_produto_checklist;
CREATE POLICY "checklist_insert" ON public.china_produto_checklist
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_write_china_submissao(submissao_id, auth.uid()));
CREATE POLICY "checklist_update" ON public.china_produto_checklist
  FOR UPDATE TO authenticated
  USING (public.user_can_write_china_submissao(submissao_id, auth.uid()))
  WITH CHECK (public.user_can_write_china_submissao(submissao_id, auth.uid()));
CREATE POLICY "checklist_delete" ON public.china_produto_checklist
  FOR DELETE TO authenticated
  USING (public.user_can_write_china_submissao(submissao_id, auth.uid()));

-- china_produto_checklist_celulas — fix broken SELECT true + unify write via checklist parent
DROP POLICY IF EXISTS "checklist_celulas_select" ON public.china_produto_checklist_celulas;
DROP POLICY IF EXISTS "checklist_celulas_write" ON public.china_produto_checklist_celulas;
CREATE POLICY "checklist_celulas_select" ON public.china_produto_checklist_celulas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.china_produto_checklist c
      WHERE c.id = china_produto_checklist_celulas.checklist_id
        AND public.user_can_access_china_submissao(c.submissao_id, auth.uid())
    )
  );
CREATE POLICY "checklist_celulas_write" ON public.china_produto_checklist_celulas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.china_produto_checklist c
      WHERE c.id = china_produto_checklist_celulas.checklist_id
        AND public.user_can_write_china_submissao(c.submissao_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.china_produto_checklist c
      WHERE c.id = china_produto_checklist_celulas.checklist_id
        AND public.user_can_write_china_submissao(c.submissao_id, auth.uid())
    )
  );

-- china_produto_cores
DROP POLICY IF EXISTS "china_cores_insert" ON public.china_produto_cores;
DROP POLICY IF EXISTS "china_cores_delete" ON public.china_produto_cores;
CREATE POLICY "china_cores_insert" ON public.china_produto_cores
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_write_china_submissao(submissao_id, auth.uid()));
CREATE POLICY "china_cores_delete" ON public.china_produto_cores
  FOR DELETE TO authenticated
  USING (public.user_can_write_china_submissao(submissao_id, auth.uid()));

-- china_produto_documentos
DROP POLICY IF EXISTS "china_doc_insert" ON public.china_produto_documentos;
DROP POLICY IF EXISTS "china_doc_update" ON public.china_produto_documentos;
DROP POLICY IF EXISTS "china_doc_delete" ON public.china_produto_documentos;
CREATE POLICY "china_doc_insert" ON public.china_produto_documentos
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_write_china_submissao(submissao_id, auth.uid()));
CREATE POLICY "china_doc_update" ON public.china_produto_documentos
  FOR UPDATE TO authenticated
  USING (public.user_can_write_china_submissao(submissao_id, auth.uid()))
  WITH CHECK (public.user_can_write_china_submissao(submissao_id, auth.uid()));
CREATE POLICY "china_doc_delete" ON public.china_produto_documentos
  FOR DELETE TO authenticated
  USING (public.user_can_write_china_submissao(submissao_id, auth.uid()));

-- ============================================================
-- FLUXO DE APROVAÇÃO: consolidate writes via can_write_fluxo_instancia
-- ============================================================

-- Anexos: remove duplicated inserts, add scoped SELECT
DROP POLICY IF EXISTS "Authenticated can select anexos" ON public.fluxo_aprovacao_anexos;
DROP POLICY IF EXISTS "Authenticated can insert anexos" ON public.fluxo_aprovacao_anexos;
DROP POLICY IF EXISTS "Authenticated users can insert fluxo_aprovacao_anexos" ON public.fluxo_aprovacao_anexos;
DROP POLICY IF EXISTS "Authenticated can update anexos" ON public.fluxo_aprovacao_anexos;
DROP POLICY IF EXISTS "Authenticated users can delete fluxo_aprovacao_anexos" ON public.fluxo_aprovacao_anexos;
CREATE POLICY "faa_select" ON public.fluxo_aprovacao_anexos
  FOR SELECT TO authenticated
  USING (public.can_access_fluxo_instancia(instancia_id, auth.uid()));
CREATE POLICY "faa_insert" ON public.fluxo_aprovacao_anexos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_fluxo_instancia(instancia_id, auth.uid()));
CREATE POLICY "faa_update" ON public.fluxo_aprovacao_anexos
  FOR UPDATE TO authenticated
  USING (public.can_write_fluxo_instancia(instancia_id, auth.uid()))
  WITH CHECK (public.can_write_fluxo_instancia(instancia_id, auth.uid()));
CREATE POLICY "faa_delete" ON public.fluxo_aprovacao_anexos
  FOR DELETE TO authenticated
  USING (public.can_write_fluxo_instancia(instancia_id, auth.uid()));

-- Transições
DROP POLICY IF EXISTS "Authenticated can insert transitions" ON public.fluxo_aprovacao_transicoes;
DROP POLICY IF EXISTS "Authenticated users can insert fluxo_aprovacao_transicoes" ON public.fluxo_aprovacao_transicoes;
CREATE POLICY "fat_insert" ON public.fluxo_aprovacao_transicoes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_fluxo_instancia(instancia_id, auth.uid()));

-- Vínculos
DROP POLICY IF EXISTS "Authenticated can insert vinculos" ON public.fluxo_aprovacao_vinculos;
DROP POLICY IF EXISTS "Authenticated users can insert fluxo_aprovacao_vinculos" ON public.fluxo_aprovacao_vinculos;
CREATE POLICY "fav_insert" ON public.fluxo_aprovacao_vinculos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_fluxo_instancia(instancia_id, auth.uid()));

-- Eventos: harden INSERT/UPDATE
DROP POLICY IF EXISTS "faee_insert" ON public.fluxo_aprovacao_etapa_eventos;
DROP POLICY IF EXISTS "faee_update" ON public.fluxo_aprovacao_etapa_eventos;
CREATE POLICY "faee_insert" ON public.fluxo_aprovacao_etapa_eventos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_fluxo_instancia(instancia_id, auth.uid()));
CREATE POLICY "faee_update" ON public.fluxo_aprovacao_etapa_eventos
  FOR UPDATE TO authenticated
  USING (
    responsavel_id = auth.uid()
    OR public.can_write_fluxo_instancia(instancia_id, auth.uid())
  )
  WITH CHECK (
    responsavel_id = auth.uid()
    OR public.can_write_fluxo_instancia(instancia_id, auth.uid())
  );

-- Lote de documentos: consolidate write policies
DROP POLICY IF EXISTS "falde_insert" ON public.fluxo_aprovacao_lote_documentos;
DROP POLICY IF EXISTS "falde_delete" ON public.fluxo_aprovacao_lote_documentos;
CREATE POLICY "falde_insert" ON public.fluxo_aprovacao_lote_documentos
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_fluxo_instancia(instancia_id, auth.uid()));
CREATE POLICY "falde_delete" ON public.fluxo_aprovacao_lote_documentos
  FOR DELETE TO authenticated
  USING (public.can_write_fluxo_instancia(instancia_id, auth.uid()));
