-- Finding: produto_brasil_pasta_digital_overpermissive (e tabelas correlatas)
-- Antes: policies "Authenticated users can ..." com USING/CHECK = (auth.uid() IS NOT NULL) ou true
-- Depois: leitura/escrita restritas a admin, supervisor, usuários do módulo fabrica
--         e, quando há coluna created_by, ao criador do registro.
-- Rollback: recriar policies antigas com USING/CHECK = (auth.uid() IS NOT NULL).

BEGIN;

-- =========================================================================
-- 1) produto_brasil_pasta_digital
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can view pasta digital" ON public.produto_brasil_pasta_digital;
DROP POLICY IF EXISTS "produto_brasil_pasta_digital_scoped_select" ON public.produto_brasil_pasta_digital;
DROP POLICY IF EXISTS "Authenticated users can insert pasta digital" ON public.produto_brasil_pasta_digital;
DROP POLICY IF EXISTS "Authenticated users can insert produto_brasil_pasta_digital" ON public.produto_brasil_pasta_digital;
DROP POLICY IF EXISTS "Authenticated users can update pasta digital" ON public.produto_brasil_pasta_digital;
DROP POLICY IF EXISTS "Authenticated users can update produto_brasil_pasta_digital" ON public.produto_brasil_pasta_digital;
DROP POLICY IF EXISTS "Authenticated users can delete pasta digital" ON public.produto_brasil_pasta_digital;
DROP POLICY IF EXISTS "Authenticated users can delete produto_brasil_pasta_digital" ON public.produto_brasil_pasta_digital;

CREATE POLICY "pasta_digital_select"
  ON public.produto_brasil_pasta_digital FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR created_by = (select auth.uid())
  );

CREATE POLICY "pasta_digital_insert"
  ON public.produto_brasil_pasta_digital FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND (
      has_role((select auth.uid()), 'admin'::app_role)
      OR has_role((select auth.uid()), 'supervisor'::app_role)
      OR check_user_access((select auth.uid()), 'fabrica'::text)
    )
  );

CREATE POLICY "pasta_digital_update"
  ON public.produto_brasil_pasta_digital FOR UPDATE TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  )
  WITH CHECK (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  );

CREATE POLICY "pasta_digital_delete"
  ON public.produto_brasil_pasta_digital FOR DELETE TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  );

-- =========================================================================
-- 2) produto_brasil_imagens
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage produto_brasil_imagens" ON public.produto_brasil_imagens;

CREATE POLICY "produto_brasil_imagens_select"
  ON public.produto_brasil_imagens FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  );

CREATE POLICY "produto_brasil_imagens_write"
  ON public.produto_brasil_imagens FOR ALL TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  )
  WITH CHECK (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  );

-- =========================================================================
-- 3) produto_brasil_historico
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage produto_brasil_historico" ON public.produto_brasil_historico;

CREATE POLICY "produto_brasil_historico_select"
  ON public.produto_brasil_historico FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR user_id = (select auth.uid())
  );

CREATE POLICY "produto_brasil_historico_insert"
  ON public.produto_brasil_historico FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND (
      has_role((select auth.uid()), 'admin'::app_role)
      OR has_role((select auth.uid()), 'supervisor'::app_role)
      OR check_user_access((select auth.uid()), 'fabrica'::text)
    )
  );

CREATE POLICY "produto_brasil_historico_update"
  ON public.produto_brasil_historico FOR UPDATE TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
  )
  WITH CHECK (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
  );

CREATE POLICY "produto_brasil_historico_delete"
  ON public.produto_brasil_historico FOR DELETE TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
  );

-- =========================================================================
-- 4) produto_brasil_checklist
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage produto_brasil_checklist" ON public.produto_brasil_checklist;

CREATE POLICY "produto_brasil_checklist_select"
  ON public.produto_brasil_checklist FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  );

CREATE POLICY "produto_brasil_checklist_write"
  ON public.produto_brasil_checklist FOR ALL TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  )
  WITH CHECK (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  );

-- =========================================================================
-- 5) produto_brasil_grade_itens (sem ownership direto; vínculo via produto pai)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage grade items" ON public.produto_brasil_grade_itens;

CREATE POLICY "produto_brasil_grade_itens_select"
  ON public.produto_brasil_grade_itens FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  );

CREATE POLICY "produto_brasil_grade_itens_write"
  ON public.produto_brasil_grade_itens FOR ALL TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  )
  WITH CHECK (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  );

-- =========================================================================
-- 6) produto_brasil_skus
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage produto_brasil_skus" ON public.produto_brasil_skus;

CREATE POLICY "produto_brasil_skus_select"
  ON public.produto_brasil_skus FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  );

CREATE POLICY "produto_brasil_skus_write"
  ON public.produto_brasil_skus FOR ALL TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  )
  WITH CHECK (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
  );

-- =========================================================================
-- 7) produto_amostras (tem created_by)
-- =========================================================================
DROP POLICY IF EXISTS "Auth users manage amostras" ON public.produto_amostras;

CREATE POLICY "produto_amostras_select"
  ON public.produto_amostras FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR created_by = (select auth.uid())
  );

CREATE POLICY "produto_amostras_insert"
  ON public.produto_amostras FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND (
      has_role((select auth.uid()), 'admin'::app_role)
      OR has_role((select auth.uid()), 'supervisor'::app_role)
      OR check_user_access((select auth.uid()), 'fabrica'::text)
    )
  );

CREATE POLICY "produto_amostras_update"
  ON public.produto_amostras FOR UPDATE TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR created_by = (select auth.uid())
  )
  WITH CHECK (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR created_by = (select auth.uid())
  );

CREATE POLICY "produto_amostras_delete"
  ON public.produto_amostras FOR DELETE TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
  );

-- =========================================================================
-- 8) produto_solicitacao_amostra (tem created_by)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage produto_solicitacao_amostra" ON public.produto_solicitacao_amostra;

CREATE POLICY "produto_solicitacao_amostra_select"
  ON public.produto_solicitacao_amostra FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR created_by = (select auth.uid())
  );

CREATE POLICY "produto_solicitacao_amostra_insert"
  ON public.produto_solicitacao_amostra FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
  );

CREATE POLICY "produto_solicitacao_amostra_update"
  ON public.produto_solicitacao_amostra FOR UPDATE TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR created_by = (select auth.uid())
  )
  WITH CHECK (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR created_by = (select auth.uid())
  );

CREATE POLICY "produto_solicitacao_amostra_delete"
  ON public.produto_solicitacao_amostra FOR DELETE TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
  );

-- =========================================================================
-- 9) produto_analise_embalagem (tem created_by)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage produto_analise_embalagem" ON public.produto_analise_embalagem;

CREATE POLICY "produto_analise_embalagem_select"
  ON public.produto_analise_embalagem FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR created_by = (select auth.uid())
  );

CREATE POLICY "produto_analise_embalagem_insert"
  ON public.produto_analise_embalagem FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND (
      has_role((select auth.uid()), 'admin'::app_role)
      OR has_role((select auth.uid()), 'supervisor'::app_role)
      OR check_user_access((select auth.uid()), 'fabrica'::text)
    )
  );

CREATE POLICY "produto_analise_embalagem_update"
  ON public.produto_analise_embalagem FOR UPDATE TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR created_by = (select auth.uid())
  )
  WITH CHECK (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR check_user_access((select auth.uid()), 'fabrica'::text)
    OR created_by = (select auth.uid())
  );

CREATE POLICY "produto_analise_embalagem_delete"
  ON public.produto_analise_embalagem FOR DELETE TO authenticated
  USING (
    has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
  );

COMMIT;