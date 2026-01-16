
-- Convert all public policies to authenticated for security
-- This is a comprehensive security fix

-- access_audit_log
DROP POLICY IF EXISTS "Admins podem ver logs de acesso" ON public.access_audit_log;
CREATE POLICY "Admins podem ver logs de acesso" ON public.access_audit_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ads_accounts
DROP POLICY IF EXISTS "Users can create their own ads accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can view their own ads accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can update their own ads accounts" ON public.ads_accounts;
DROP POLICY IF EXISTS "Users can delete their own ads accounts" ON public.ads_accounts;
CREATE POLICY "Users can create their own ads accounts" ON public.ads_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own ads accounts" ON public.ads_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update their own ads accounts" ON public.ads_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ads accounts" ON public.ads_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ads_campaign_metrics
DROP POLICY IF EXISTS "Users can view campaign metrics" ON public.ads_campaign_metrics;
CREATE POLICY "Users can view campaign metrics" ON public.ads_campaign_metrics FOR SELECT TO authenticated USING (true);

-- ads_campaigns
DROP POLICY IF EXISTS "Users can manage campaigns for their accounts" ON public.ads_campaigns;
DROP POLICY IF EXISTS "Users can view campaigns for their accounts" ON public.ads_campaigns;
CREATE POLICY "Users can view campaigns for their accounts" ON public.ads_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage campaigns for their accounts" ON public.ads_campaigns FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- ads_metrics
DROP POLICY IF EXISTS "Users can insert metrics for their accounts" ON public.ads_metrics;
DROP POLICY IF EXISTS "Users can view metrics for their accounts" ON public.ads_metrics;
CREATE POLICY "Users can view metrics for their accounts" ON public.ads_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert metrics for their accounts" ON public.ads_metrics FOR INSERT TO authenticated WITH CHECK (true);

-- agg_daily_kpis
DROP POLICY IF EXISTS "Usuários aprovados podem ver KPIs agregados" ON public.agg_daily_kpis;
CREATE POLICY "Usuários aprovados podem ver KPIs agregados" ON public.agg_daily_kpis FOR SELECT TO authenticated USING (true);

-- ai_call_actions
DROP POLICY IF EXISTS "Acesso a ações via call" ON public.ai_call_actions;
CREATE POLICY "Acesso a ações via call" ON public.ai_call_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ai_call_transcriptions
DROP POLICY IF EXISTS "Acesso a transcrições via call" ON public.ai_call_transcriptions;
CREATE POLICY "Acesso a transcrições via call" ON public.ai_call_transcriptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ai_calls
DROP POLICY IF EXISTS "Vendedores atualizam suas próprias ligações" ON public.ai_calls;
DROP POLICY IF EXISTS "Vendedores criam suas próprias ligações" ON public.ai_calls;
DROP POLICY IF EXISTS "Vendedores veem suas próprias ligações" ON public.ai_calls;
CREATE POLICY "Vendedores veem suas próprias ligações" ON public.ai_calls FOR SELECT TO authenticated USING (vendedor_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Vendedores criam suas próprias ligações" ON public.ai_calls FOR INSERT TO authenticated WITH CHECK (vendedor_id = auth.uid());
CREATE POLICY "Vendedores atualizam suas próprias ligações" ON public.ai_calls FOR UPDATE TO authenticated USING (vendedor_id = auth.uid());
