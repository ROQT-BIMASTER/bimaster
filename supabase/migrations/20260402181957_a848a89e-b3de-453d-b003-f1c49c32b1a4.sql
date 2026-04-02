
-- =====================================================
-- CORREÇÃO MASSIVA DE RLS - MÓDULO DE PROJETOS
-- =====================================================

-- Helper function to check project access via tarefa_id
CREATE OR REPLACE FUNCTION public.user_can_access_projeto_via_tarefa(_user_id uuid, _tarefa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_can_access_projeto(_user_id, (
    SELECT projeto_id FROM projeto_tarefas WHERE id = _tarefa_id LIMIT 1
  ));
$$;

-- =====================================================
-- 1. FIX: projeto_membros INSERT (self-join bug)
-- =====================================================
DROP POLICY IF EXISTS "Coordinators manage members" ON projeto_membros;
CREATE POLICY "Coordinators manage members" ON projeto_membros
  FOR INSERT TO authenticated
  WITH CHECK (
    (EXISTS (SELECT 1 FROM projetos WHERE projetos.id = projeto_membros.projeto_id AND projetos.criador_id = auth.uid()))
    OR
    (EXISTS (SELECT 1 FROM projeto_membros pm2 WHERE pm2.projeto_id = projeto_membros.projeto_id AND pm2.user_id = auth.uid() AND pm2.papel = 'coordenador'))
  );

-- =====================================================
-- 2. FIX: projetos UPDATE (wrong join pm.projeto_id = pm.id)
-- =====================================================
DROP POLICY IF EXISTS "Members can update projetos" ON projetos;
CREATE POLICY "Members can update projetos" ON projetos
  FOR UPDATE TO authenticated
  USING (
    criador_id = auth.uid()
    OR EXISTS (SELECT 1 FROM projeto_membros pm WHERE pm.projeto_id = projetos.id AND pm.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- =====================================================
-- 3. FIX: projeto_tarefas INSERT/UPDATE/DELETE (wide open)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can insert projeto_tarefas" ON projeto_tarefas;
CREATE POLICY "Members can insert projeto_tarefas" ON projeto_tarefas
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto(auth.uid(), projeto_id));

DROP POLICY IF EXISTS "Authenticated users can update projeto_tarefas" ON projeto_tarefas;
CREATE POLICY "Members can update projeto_tarefas" ON projeto_tarefas
  FOR UPDATE TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id));

DROP POLICY IF EXISTS "Authenticated users can delete projeto_tarefas" ON projeto_tarefas;
CREATE POLICY "Members can delete projeto_tarefas" ON projeto_tarefas
  FOR DELETE TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id));

-- =====================================================
-- 4. FIX: projeto_secoes INSERT/UPDATE/DELETE
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can insert projeto_secoes" ON projeto_secoes;
CREATE POLICY "Members can insert projeto_secoes" ON projeto_secoes
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto(auth.uid(), projeto_id));

DROP POLICY IF EXISTS "Authenticated users can update projeto_secoes" ON projeto_secoes;
CREATE POLICY "Members can update projeto_secoes" ON projeto_secoes
  FOR UPDATE TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id));

DROP POLICY IF EXISTS "Authenticated users can delete projeto_secoes" ON projeto_secoes;
CREATE POLICY "Members can delete projeto_secoes" ON projeto_secoes
  FOR DELETE TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id));

-- =====================================================
-- 5. FIX: projeto_tarefa_documentos (drop duplicate permissive ALL policy)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can manage task documents" ON projeto_tarefa_documentos;

-- =====================================================
-- 6. FIX: projeto_tarefa_anexos SELECT (was USING true)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can read attachments" ON projeto_tarefa_anexos;
CREATE POLICY "Members can read attachments" ON projeto_tarefa_anexos
  FOR SELECT TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

-- Also restrict INSERT/DELETE to project members
DROP POLICY IF EXISTS "Users can insert own attachments" ON projeto_tarefa_anexos;
CREATE POLICY "Members can insert attachments" ON projeto_tarefa_anexos
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own attachments" ON projeto_tarefa_anexos;
CREATE POLICY "Members can delete own attachments" ON projeto_tarefa_anexos
  FOR DELETE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id) AND auth.uid() = user_id);

-- =====================================================
-- 7. FIX: projeto_tarefa_colaboradores SELECT/DELETE/INSERT
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view projeto_tarefa_colaboradores" ON projeto_tarefa_colaboradores;
CREATE POLICY "Members can view colaboradores" ON projeto_tarefa_colaboradores
  FOR SELECT TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

DROP POLICY IF EXISTS "Authenticated users can insert projeto_tarefa_colaboradores" ON projeto_tarefa_colaboradores;
CREATE POLICY "Members can insert colaboradores" ON projeto_tarefa_colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

DROP POLICY IF EXISTS "Authenticated users can delete projeto_tarefa_colaboradores" ON projeto_tarefa_colaboradores;
CREATE POLICY "Members can delete colaboradores" ON projeto_tarefa_colaboradores
  FOR DELETE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

-- =====================================================
-- 8. FIX: projeto_tarefa_comentarios SELECT
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can read comments" ON projeto_tarefa_comentarios;
CREATE POLICY "Members can read comments" ON projeto_tarefa_comentarios
  FOR SELECT TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

DROP POLICY IF EXISTS "Users can insert own comments" ON projeto_tarefa_comentarios;
CREATE POLICY "Members can insert comments" ON projeto_tarefa_comentarios
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON projeto_tarefa_comentarios;
CREATE POLICY "Members can delete own comments" ON projeto_tarefa_comentarios
  FOR DELETE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id) AND auth.uid() = user_id);

-- =====================================================
-- 9. FIX: projeto_tarefa_metas (has duplicate policies)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can select metas" ON projeto_tarefa_metas;
DROP POLICY IF EXISTS "Authenticated users can insert metas" ON projeto_tarefa_metas;
DROP POLICY IF EXISTS "Authenticated users can update metas" ON projeto_tarefa_metas;
DROP POLICY IF EXISTS "Authenticated users can delete metas" ON projeto_tarefa_metas;
DROP POLICY IF EXISTS "Authenticated users can insert projeto_tarefa_metas" ON projeto_tarefa_metas;
DROP POLICY IF EXISTS "Authenticated users can update projeto_tarefa_metas" ON projeto_tarefa_metas;
DROP POLICY IF EXISTS "Authenticated users can delete projeto_tarefa_metas" ON projeto_tarefa_metas;

CREATE POLICY "Members can select metas" ON projeto_tarefa_metas
  FOR SELECT TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can insert metas" ON projeto_tarefa_metas
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can update metas" ON projeto_tarefa_metas
  FOR UPDATE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can delete metas" ON projeto_tarefa_metas
  FOR DELETE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

-- =====================================================
-- 10. FIX: projeto_tarefa_metas_calendario
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can manage task metas" ON projeto_tarefa_metas_calendario;

CREATE POLICY "Members can select metas_calendario" ON projeto_tarefa_metas_calendario
  FOR SELECT TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can insert metas_calendario" ON projeto_tarefa_metas_calendario
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can update metas_calendario" ON projeto_tarefa_metas_calendario
  FOR UPDATE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can delete metas_calendario" ON projeto_tarefa_metas_calendario
  FOR DELETE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

-- =====================================================
-- 11. FIX: projeto_tarefa_movimentacoes (duplicate INSERT + open SELECT)
-- =====================================================
DROP POLICY IF EXISTS "Users can view task movements" ON projeto_tarefa_movimentacoes;
DROP POLICY IF EXISTS "Users can create task movements" ON projeto_tarefa_movimentacoes;
DROP POLICY IF EXISTS "Authenticated users can insert projeto_tarefa_movimentacoes" ON projeto_tarefa_movimentacoes;

CREATE POLICY "Members can view movements" ON projeto_tarefa_movimentacoes
  FOR SELECT TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can insert movements" ON projeto_tarefa_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

-- =====================================================
-- 12. FIX: projeto_tarefa_produtos (duplicate policies + open)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view tarefa produtos" ON projeto_tarefa_produtos;
DROP POLICY IF EXISTS "Authenticated users can insert tarefa produtos" ON projeto_tarefa_produtos;
DROP POLICY IF EXISTS "Authenticated users can delete tarefa produtos" ON projeto_tarefa_produtos;
DROP POLICY IF EXISTS "Authenticated users can insert projeto_tarefa_produtos" ON projeto_tarefa_produtos;
DROP POLICY IF EXISTS "Authenticated users can delete projeto_tarefa_produtos" ON projeto_tarefa_produtos;

CREATE POLICY "Members can view tarefa_produtos" ON projeto_tarefa_produtos
  FOR SELECT TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can insert tarefa_produtos" ON projeto_tarefa_produtos
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can delete tarefa_produtos" ON projeto_tarefa_produtos
  FOR DELETE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

-- =====================================================
-- 13. FIX: projeto_tarefa_tags
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can manage tarefa_tags" ON projeto_tarefa_tags;
DROP POLICY IF EXISTS "Authenticated users can view tarefa_tags" ON projeto_tarefa_tags;

CREATE POLICY "Members can view tarefa_tags" ON projeto_tarefa_tags
  FOR SELECT TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can insert tarefa_tags" ON projeto_tarefa_tags
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can delete tarefa_tags" ON projeto_tarefa_tags
  FOR DELETE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

-- =====================================================
-- 14. FIX: projeto_tarefa_validacoes
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can manage validacoes" ON projeto_tarefa_validacoes;

CREATE POLICY "Members can select validacoes" ON projeto_tarefa_validacoes
  FOR SELECT TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can insert validacoes" ON projeto_tarefa_validacoes
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can update validacoes" ON projeto_tarefa_validacoes
  FOR UPDATE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

CREATE POLICY "Members can delete validacoes" ON projeto_tarefa_validacoes
  FOR DELETE TO authenticated
  USING (user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

-- =====================================================
-- 15. FIX: projeto_planos_acao
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can manage planos" ON projeto_planos_acao;

CREATE POLICY "Members can select planos" ON projeto_planos_acao
  FOR SELECT TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Members can insert planos" ON projeto_planos_acao
  FOR INSERT TO authenticated
  WITH CHECK (user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Members can update planos" ON projeto_planos_acao
  FOR UPDATE TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id));

CREATE POLICY "Members can delete planos" ON projeto_planos_acao
  FOR DELETE TO authenticated
  USING (user_can_access_projeto(auth.uid(), projeto_id));
