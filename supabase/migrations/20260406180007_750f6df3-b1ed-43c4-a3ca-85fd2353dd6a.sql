
-- 1. CRÍTICO: Dropar acesso anônimo total em planos_reducao
DROP POLICY IF EXISTS "Acesso público planos_reducao" ON public.planos_reducao;

-- 2. Dropar policy PERMISSIVE inútil em stores
DROP POLICY IF EXISTS "stores_select_blocked" ON public.stores;

-- 3. department_budgets: restringir SELECT
DROP POLICY IF EXISTS "Allow authenticated users to view department budgets" ON public.department_budgets;
CREATE POLICY "department_budgets_select_restricted" ON public.department_budgets
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'::text)
  );

-- 4. trade_campaign_expenses: restringir SELECT
DROP POLICY IF EXISTS "Allow authenticated to view trade campaign expenses" ON public.trade_campaign_expenses;
DROP POLICY IF EXISTS "trade_campaign_expenses_select" ON public.trade_campaign_expenses;
CREATE POLICY "trade_campaign_expenses_select_restricted" ON public.trade_campaign_expenses
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'trade_marketing'::text)
  );

-- 5. ap_data_source_config: restringir tudo a admin/supervisor
DROP POLICY IF EXISTS "Authenticated users can read ap_data_source_config" ON public.ap_data_source_config;
DROP POLICY IF EXISTS "Authenticated users can insert ap_data_source_config" ON public.ap_data_source_config;
DROP POLICY IF EXISTS "Authenticated users can update ap_data_source_config" ON public.ap_data_source_config;

CREATE POLICY "ap_data_source_config_select" ON public.ap_data_source_config
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "ap_data_source_config_insert" ON public.ap_data_source_config
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "ap_data_source_config_update" ON public.ap_data_source_config
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  );

-- 6. fabrica_custo_evidencias: alinhar SELECT com can_access_fabrica
DROP POLICY IF EXISTS "Authenticated users can view cost evidence" ON public.fabrica_custo_evidencias;
CREATE POLICY "fabrica_custo_evidencias_select" ON public.fabrica_custo_evidencias
  FOR SELECT TO authenticated
  USING (can_access_fabrica(auth.uid()));

-- 7. fabrica_insumo_custo_historico: alinhar SELECT
DROP POLICY IF EXISTS "Authenticated users can view cost history" ON public.fabrica_insumo_custo_historico;
CREATE POLICY "fabrica_insumo_custo_historico_select" ON public.fabrica_insumo_custo_historico
  FOR SELECT TO authenticated
  USING (can_access_fabrica(auth.uid()));

-- 8. financial_correction_rules: dropar ALL redundante, restringir SELECT
DROP POLICY IF EXISTS "Authenticated users can manage correction rules" ON public.financial_correction_rules;
DROP POLICY IF EXISTS "Authenticated users can read correction rules" ON public.financial_correction_rules;

CREATE POLICY "financial_correction_rules_select" ON public.financial_correction_rules
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'::text)
  );

CREATE POLICY "financial_correction_rules_insert" ON public.financial_correction_rules
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "financial_correction_rules_update" ON public.financial_correction_rules
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "financial_correction_rules_delete" ON public.financial_correction_rules
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
  );
