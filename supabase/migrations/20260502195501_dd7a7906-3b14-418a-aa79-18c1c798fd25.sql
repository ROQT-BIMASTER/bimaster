BEGIN;

-- ==================================================================
-- LOTE A.0 — BACKFILL
-- ==================================================================
INSERT INTO public.user_empresas (user_id, empresa_id, is_primary)
SELECT u.id, 4, true
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_empresas ue WHERE ue.user_id = u.id)
ON CONFLICT DO NOTHING;

-- ==================================================================
-- LOTE A.1 — boletos.INSERT
-- ==================================================================
DROP POLICY IF EXISTS "Authenticated users can insert boletos" ON public.boletos;

CREATE POLICY boletos_insert_empresa_scoped ON public.boletos FOR INSERT TO authenticated
  WITH CHECK (
    has_role((select auth.uid()),'admin'::app_role)
    OR empresa_id IN (SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = (select auth.uid()))
  );

-- ==================================================================
-- LOTE A.2 — centros_custo.SELECT
-- ==================================================================
DROP POLICY IF EXISTS authenticated_select_centros_custo ON public.centros_custo;

CREATE POLICY centros_custo_select_empresa ON public.centros_custo FOR SELECT TO authenticated
  USING (
    has_role((select auth.uid()),'admin'::app_role)
    OR empresa_id IN (SELECT ue.empresa_id FROM public.user_empresas ue WHERE ue.user_id = (select auth.uid()))
  );

-- ==================================================================
-- LOTE A.3 — oms_condicoes_pagamento (sem empresa_id; tratado como lookup do módulo vendas)
-- ==================================================================
DROP POLICY IF EXISTS "Authenticated users can manage oms_condicoes_pagamento" ON public.oms_condicoes_pagamento;
DROP POLICY IF EXISTS "Authenticated users can view oms_condicoes_pagamento" ON public.oms_condicoes_pagamento;

CREATE POLICY ocp_select ON public.oms_condicoes_pagamento FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'vendas'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY ocp_modify ON public.oms_condicoes_pagamento FOR ALL TO authenticated
  USING (has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- ==================================================================
-- LOTE A.4 — api_support_messages
-- ==================================================================
DROP POLICY IF EXISTS authenticated_insert ON public.api_support_messages;

CREATE POLICY support_messages_insert_own ON public.api_support_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND (empresa_id IS NULL OR empresa_id IN (SELECT ue.empresa_id::text FROM public.user_empresas ue WHERE ue.user_id = (select auth.uid())))
  );

-- ==================================================================
-- LOTE D — Lookups de módulo
-- ==================================================================

-- marketing_alertas
DROP POLICY IF EXISTS "Authenticated users can manage alerts" ON public.marketing_alertas;
DROP POLICY IF EXISTS "Users can view their alerts" ON public.marketing_alertas;
CREATE POLICY mkt_alertas_select ON public.marketing_alertas FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role) OR destinatario_id = (select auth.uid()));
CREATE POLICY mkt_alertas_modify ON public.marketing_alertas FOR ALL TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role))
  WITH CHECK (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));

-- marketing_aprovacoes
DROP POLICY IF EXISTS "Authenticated users can manage approvals" ON public.marketing_aprovacoes;
DROP POLICY IF EXISTS "Authenticated users can view approvals" ON public.marketing_aprovacoes;
CREATE POLICY mkt_aprov_select ON public.marketing_aprovacoes FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY mkt_aprov_modify ON public.marketing_aprovacoes FOR ALL TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role))
  WITH CHECK (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));

-- marketing_automacoes_log
DROP POLICY IF EXISTS "Insert automation logs" ON public.marketing_automacoes_log;
DROP POLICY IF EXISTS "View automation logs" ON public.marketing_automacoes_log;
CREATE POLICY mkt_aulog_select ON public.marketing_automacoes_log FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY mkt_aulog_insert ON public.marketing_automacoes_log FOR INSERT TO authenticated
  WITH CHECK (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));

-- marketing_automacoes (substitui SELECT)
DROP POLICY IF EXISTS "View automations" ON public.marketing_automacoes;
DROP POLICY IF EXISTS ma_select ON public.marketing_automacoes;
CREATE POLICY ma_select ON public.marketing_automacoes FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role) OR created_by = (select auth.uid()));

-- marketing_badges
DROP POLICY IF EXISTS "Authenticated users can view badges" ON public.marketing_badges;
CREATE POLICY mkt_badges_select ON public.marketing_badges FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));

-- marketing_campanhas (substitui SELECT)
DROP POLICY IF EXISTS "Authenticated users can view campaigns" ON public.marketing_campanhas;
DROP POLICY IF EXISTS mc_select ON public.marketing_campanhas;
CREATE POLICY mc_select ON public.marketing_campanhas FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role) OR created_by = (select auth.uid()));

-- marketing_papeis
DROP POLICY IF EXISTS "Authenticated users can manage roles" ON public.marketing_papeis;
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.marketing_papeis;
CREATE POLICY mkt_papeis_select ON public.marketing_papeis FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY mkt_papeis_modify ON public.marketing_papeis FOR ALL TO authenticated
  USING (has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- marketing_sla_config
DROP POLICY IF EXISTS "Authenticated users can manage SLA config" ON public.marketing_sla_config;
DROP POLICY IF EXISTS "Authenticated users can view SLA config" ON public.marketing_sla_config;
CREATE POLICY mkt_sla_select ON public.marketing_sla_config FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY mkt_sla_modify ON public.marketing_sla_config FOR ALL TO authenticated
  USING (has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- marketing_tarefas_dependencias
DROP POLICY IF EXISTS "Manage dependencies" ON public.marketing_tarefas_dependencias;
DROP POLICY IF EXISTS "View dependencies" ON public.marketing_tarefas_dependencias;
CREATE POLICY mkt_dep_select ON public.marketing_tarefas_dependencias FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY mkt_dep_modify ON public.marketing_tarefas_dependencias FOR ALL TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role))
  WITH CHECK (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));

-- marketing_templates (substitui SELECT)
DROP POLICY IF EXISTS "View templates" ON public.marketing_templates;
DROP POLICY IF EXISTS mt_select ON public.marketing_templates;
CREATE POLICY mt_select ON public.marketing_templates FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role) OR created_by = (select auth.uid()));

-- marketing_workflow_etapas
DROP POLICY IF EXISTS "Authenticated users can manage workflow stages" ON public.marketing_workflow_etapas;
DROP POLICY IF EXISTS "Authenticated users can view workflow stages" ON public.marketing_workflow_etapas;
CREATE POLICY mkt_wf_select ON public.marketing_workflow_etapas FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'marketing'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY mkt_wf_modify ON public.marketing_workflow_etapas FOR ALL TO authenticated
  USING (has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

-- china_checklist_itens_ocultos
DROP POLICY IF EXISTS "Authenticated users can manage hidden checklist items" ON public.china_checklist_itens_ocultos;
CREATE POLICY ccio_select ON public.china_checklist_itens_ocultos FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'fabrica'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY ccio_modify ON public.china_checklist_itens_ocultos FOR ALL TO authenticated
  USING (check_user_access((select auth.uid()),'fabrica'::text) OR has_role((select auth.uid()),'admin'::app_role))
  WITH CHECK (check_user_access((select auth.uid()),'fabrica'::text) OR has_role((select auth.uid()),'admin'::app_role));

-- ==================================================================
-- LOTE C — process_* (ownership via usuario_id/juntado_por/responsavel_id + admin/supervisor)
-- ==================================================================

-- process_events: SELECT amplo (módulo fábrica), modificações restritas
DROP POLICY IF EXISTS "Authenticated users can manage process events" ON public.process_events;
CREATE POLICY pe_select ON public.process_events FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'fabrica'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY pe_insert ON public.process_events FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = (select auth.uid())
    AND (check_user_access((select auth.uid()),'fabrica'::text) OR has_role((select auth.uid()),'admin'::app_role))
  );
CREATE POLICY pe_update ON public.process_events FOR UPDATE TO authenticated
  USING (usuario_id = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (usuario_id = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));
CREATE POLICY pe_delete ON public.process_events FOR DELETE TO authenticated
  USING (has_role((select auth.uid()),'admin'::app_role));

-- process_step_history
DROP POLICY IF EXISTS "Authenticated users can manage step history" ON public.process_step_history;
CREATE POLICY psh_select ON public.process_step_history FOR SELECT TO authenticated
  USING (check_user_access((select auth.uid()),'fabrica'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY psh_insert ON public.process_step_history FOR INSERT TO authenticated
  WITH CHECK (check_user_access((select auth.uid()),'fabrica'::text) OR has_role((select auth.uid()),'admin'::app_role));
CREATE POLICY psh_update ON public.process_step_history FOR UPDATE TO authenticated
  USING (responsavel_id = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (responsavel_id = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));
CREATE POLICY psh_delete ON public.process_step_history FOR DELETE TO authenticated
  USING (has_role((select auth.uid()),'admin'::app_role));

-- process_juntadas (criador = juntado_por)
DROP POLICY IF EXISTS "Authenticated can insert juntadas" ON public.process_juntadas;
DROP POLICY IF EXISTS "Authenticated can update juntadas" ON public.process_juntadas;
DROP POLICY IF EXISTS "Authenticated users can insert process_juntadas" ON public.process_juntadas;
DROP POLICY IF EXISTS "Authenticated users can update process_juntadas" ON public.process_juntadas;
CREATE POLICY pj_insert ON public.process_juntadas FOR INSERT TO authenticated
  WITH CHECK (
    juntado_por = (select auth.uid())
    AND (check_user_access((select auth.uid()),'fabrica'::text) OR has_role((select auth.uid()),'admin'::app_role))
  );
CREATE POLICY pj_update ON public.process_juntadas FOR UPDATE TO authenticated
  USING (juntado_por = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role))
  WITH CHECK (juntado_por = (select auth.uid()) OR has_role((select auth.uid()),'admin'::app_role) OR has_role((select auth.uid()),'supervisor'::app_role));

COMMIT;