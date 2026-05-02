-- Lote B — Ownership em DELETE/UPDATE
-- Antes: USING/CHECK = (auth.uid() IS NOT NULL) — qualquer usuário deletava/alterava
-- Depois: created_by = auth.uid() (ou user_id) OR admin/supervisor
-- Rollback: recriar policies antigas com (auth.uid() IS NOT NULL)

BEGIN;

-- =========================================================================
-- 1) china_checklist_custom_categorias  (ALL → split em 4)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage custom checklist categories" ON public.china_checklist_custom_categorias;

CREATE POLICY ccc_select ON public.china_checklist_custom_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY ccc_insert ON public.china_checklist_custom_categorias FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));
CREATE POLICY ccc_update ON public.china_checklist_custom_categorias FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));
CREATE POLICY ccc_delete ON public.china_checklist_custom_categorias FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 2) china_checklist_custom_itens
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage custom checklist items" ON public.china_checklist_custom_itens;

CREATE POLICY cci_select ON public.china_checklist_custom_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY cci_insert ON public.china_checklist_custom_itens FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));
CREATE POLICY cci_update ON public.china_checklist_custom_itens FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));
CREATE POLICY cci_delete ON public.china_checklist_custom_itens FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 3) china_documento_tarefa_vinculos
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage doc vinculos" ON public.china_documento_tarefa_vinculos;

CREATE POLICY cdtv_select ON public.china_documento_tarefa_vinculos FOR SELECT TO authenticated USING (true);
CREATE POLICY cdtv_insert ON public.china_documento_tarefa_vinculos FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));
CREATE POLICY cdtv_update ON public.china_documento_tarefa_vinculos FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));
CREATE POLICY cdtv_delete ON public.china_documento_tarefa_vinculos FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 4) china_embarques (UPDATE)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can update embarques" ON public.china_embarques;

CREATE POLICY china_embarques_update ON public.china_embarques FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text));

-- =========================================================================
-- 5) china_ficha_visibilidade (DELETE) — usa user_id
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can delete visibility records" ON public.china_ficha_visibilidade;

CREATE POLICY cfv_delete ON public.china_ficha_visibilidade FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 6) china_ordens_compra (UPDATE)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can update china_ordens_compra" ON public.china_ordens_compra;

CREATE POLICY china_oc_update ON public.china_ordens_compra FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text));

-- =========================================================================
-- 7) china_recebimentos_carga (DELETE + UPDATE)
-- =========================================================================
DROP POLICY IF EXISTS "auth delete china_recebimentos_carga" ON public.china_recebimentos_carga;
DROP POLICY IF EXISTS "auth update china_recebimentos_carga" ON public.china_recebimentos_carga;

CREATE POLICY crc_update ON public.china_recebimentos_carga FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text));
CREATE POLICY crc_delete ON public.china_recebimentos_carga FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 8) fluxo_aprovacao_instancias (UPDATE)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated can update instances" ON public.fluxo_aprovacao_instancias;

CREATE POLICY fai_update ON public.fluxo_aprovacao_instancias FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 9) fluxo_aprovacao_vinculos (DELETE — duas duplicadas)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated can delete vinculos" ON public.fluxo_aprovacao_vinculos;
DROP POLICY IF EXISTS "Authenticated users can delete fluxo_aprovacao_vinculos" ON public.fluxo_aprovacao_vinculos;

CREATE POLICY fav_delete ON public.fluxo_aprovacao_vinculos FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 10) marketing_automacoes (ALL → split)
-- =========================================================================
DROP POLICY IF EXISTS "Manage automations" ON public.marketing_automacoes;

CREATE POLICY ma_select ON public.marketing_automacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY ma_insert ON public.marketing_automacoes FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));
CREATE POLICY ma_update ON public.marketing_automacoes FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'marketing'::text))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'marketing'::text));
CREATE POLICY ma_delete ON public.marketing_automacoes FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 11) marketing_campanhas (ALL → split)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage campaigns" ON public.marketing_campanhas;

CREATE POLICY mc_select ON public.marketing_campanhas FOR SELECT TO authenticated USING (true);
CREATE POLICY mc_insert ON public.marketing_campanhas FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));
CREATE POLICY mc_update ON public.marketing_campanhas FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'marketing'::text))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'marketing'::text));
CREATE POLICY mc_delete ON public.marketing_campanhas FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 12) marketing_templates (ALL → split)
-- =========================================================================
DROP POLICY IF EXISTS "Manage templates" ON public.marketing_templates;

CREATE POLICY mt_select ON public.marketing_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY mt_insert ON public.marketing_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));
CREATE POLICY mt_update ON public.marketing_templates FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'marketing'::text))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'marketing'::text));
CREATE POLICY mt_delete ON public.marketing_templates FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 13) modulo_processo_link (UPDATE)
-- =========================================================================
DROP POLICY IF EXISTS mpl_update_authenticated ON public.modulo_processo_link;

CREATE POLICY mpl_update ON public.modulo_processo_link FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 14) process_tipos_documento (UPDATE — duplicada)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can update process_tipos_documento" ON public.process_tipos_documento;
DROP POLICY IF EXISTS "Authenticated users can update tipos_documento" ON public.process_tipos_documento;

CREATE POLICY ptd_update ON public.process_tipos_documento FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 15) produto_etiqueta_bula (ALL → split)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage produto_etiqueta_bula" ON public.produto_etiqueta_bula;

CREATE POLICY peb_select ON public.produto_etiqueta_bula FOR SELECT TO authenticated USING (true);
CREATE POLICY peb_insert ON public.produto_etiqueta_bula FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));
CREATE POLICY peb_update ON public.produto_etiqueta_bula FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text));
CREATE POLICY peb_delete ON public.produto_etiqueta_bula FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 16) produto_fluxo_artes (ALL → split)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can manage produto_fluxo_artes" ON public.produto_fluxo_artes;

CREATE POLICY pfa_select ON public.produto_fluxo_artes FOR SELECT TO authenticated USING (true);
CREATE POLICY pfa_insert ON public.produto_fluxo_artes FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));
CREATE POLICY pfa_update ON public.produto_fluxo_artes FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text));
CREATE POLICY pfa_delete ON public.produto_fluxo_artes FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 17) produto_rnc (UPDATE — duplicada)
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated users can update produto_rnc" ON public.produto_rnc;
DROP POLICY IF EXISTS "Auth can update produto_rnc" ON public.produto_rnc;

CREATE POLICY prnc_update ON public.produto_rnc FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text));

-- =========================================================================
-- 18) produto_testes (DELETE/UPDATE — duplicadas)
-- =========================================================================
DROP POLICY IF EXISTS "Auth can delete produto_testes" ON public.produto_testes;
DROP POLICY IF EXISTS "Authenticated users can delete produto_testes" ON public.produto_testes;
DROP POLICY IF EXISTS "Auth can update produto_testes" ON public.produto_testes;
DROP POLICY IF EXISTS "Authenticated users can update produto_testes" ON public.produto_testes;

CREATE POLICY ptt_update ON public.produto_testes FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text))
  WITH CHECK (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role) OR check_user_access((select auth.uid()),'fabrica'::text));
CREATE POLICY ptt_delete ON public.produto_testes FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- =========================================================================
-- 19) projeto_membros (UPDATE) — usa user_id
-- =========================================================================
DROP POLICY IF EXISTS "Update project members" ON public.projeto_membros;

CREATE POLICY pm_update ON public.projeto_membros FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (user_id = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

COMMIT;