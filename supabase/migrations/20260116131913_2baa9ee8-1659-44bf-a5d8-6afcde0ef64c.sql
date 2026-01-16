
-- ai_insights
DROP POLICY IF EXISTS "Usuários veem insights de suas entidades" ON public.ai_insights;
DROP POLICY IF EXISTS "Apenas admins e supervisores gerenciam insights" ON public.ai_insights;
CREATE POLICY "Usuários veem insights de suas entidades" ON public.ai_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Apenas admins e supervisores gerenciam insights" ON public.ai_insights FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- analytics_metrics
DROP POLICY IF EXISTS "Users can view their analytics metrics" ON public.analytics_metrics;
DROP POLICY IF EXISTS "Users can insert their analytics metrics" ON public.analytics_metrics;
CREATE POLICY "Users can view their analytics metrics" ON public.analytics_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their analytics metrics" ON public.analytics_metrics FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- api_security_log
DROP POLICY IF EXISTS "Admin/supervisor can view security logs" ON public.api_security_log;
CREATE POLICY "Admin/supervisor can view security logs" ON public.api_security_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- assinaturas
DROP POLICY IF EXISTS "Usuários podem ver suas assinaturas" ON public.assinaturas;
DROP POLICY IF EXISTS "Admins e supervisores podem gerenciar assinaturas" ON public.assinaturas;
CREATE POLICY "Usuários podem ver suas assinaturas" ON public.assinaturas FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins e supervisores podem gerenciar assinaturas" ON public.assinaturas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- atividades
DROP POLICY IF EXISTS "Vendedores criam atividades para seus prospects" ON public.atividades;
DROP POLICY IF EXISTS "Vendedores deletam apenas suas atividades" ON public.atividades;
DROP POLICY IF EXISTS "Vendedores veem apenas suas atividades" ON public.atividades;
DROP POLICY IF EXISTS "Vendedores atualizam apenas suas atividades" ON public.atividades;
CREATE POLICY "Vendedores veem apenas suas atividades" ON public.atividades FOR SELECT TO authenticated USING (vendedor_id = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Vendedores criam atividades para seus prospects" ON public.atividades FOR INSERT TO authenticated WITH CHECK (vendedor_id = auth.uid());
CREATE POLICY "Vendedores atualizam apenas suas atividades" ON public.atividades FOR UPDATE TO authenticated USING (vendedor_id = auth.uid());
CREATE POLICY "Vendedores deletam apenas suas atividades" ON public.atividades FOR DELETE TO authenticated USING (vendedor_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- audit_logs
DROP POLICY IF EXISTS "Only admins view audit logs" ON public.audit_logs;
CREATE POLICY "Only admins view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- auditoria_atribuicoes
DROP POLICY IF EXISTS "Admins e supervisores podem ver auditoria" ON public.auditoria_atribuicoes;
CREATE POLICY "Admins e supervisores podem ver auditoria" ON public.auditoria_atribuicoes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- categoria_departamento
DROP POLICY IF EXISTS "Usuários autenticados podem criar mapeamento categoria-departa" ON public.categoria_departamento;
DROP POLICY IF EXISTS "Usuários autenticados podem ver mapeamento categoria-departame" ON public.categoria_departamento;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar mapeamento categoria-depar" ON public.categoria_departamento;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar mapeamento categoria-dep" ON public.categoria_departamento;
CREATE POLICY "Usuários autenticados podem ver mapeamento" ON public.categoria_departamento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerenciar mapeamento" ON public.categoria_departamento FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- clientes
DROP POLICY IF EXISTS "Usuários autenticados podem ler clientes" ON public.clientes;
DROP POLICY IF EXISTS "Admin e supervisor acessam todos clientes" ON public.clientes;
CREATE POLICY "Usuários autenticados podem ler clientes" ON public.clientes FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro') OR usuario_tem_acesso_modulo(auth.uid(), 'comercial'));
CREATE POLICY "Admin e supervisor acessam todos clientes" ON public.clientes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- clientes_alertas_credito
DROP POLICY IF EXISTS "Financeiro pode gerenciar alertas" ON public.clientes_alertas_credito;
DROP POLICY IF EXISTS "Financeiro pode ver alertas de crédito" ON public.clientes_alertas_credito;
CREATE POLICY "Financeiro pode ver alertas de crédito" ON public.clientes_alertas_credito FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));
CREATE POLICY "Financeiro pode gerenciar alertas" ON public.clientes_alertas_credito FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));

-- clientes_perfil_credito
DROP POLICY IF EXISTS "Financeiro pode gerenciar perfis de crédito" ON public.clientes_perfil_credito;
CREATE POLICY "Financeiro pode gerenciar perfis de crédito" ON public.clientes_perfil_credito FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));

-- clientes_score_historico
DROP POLICY IF EXISTS "Financeiro pode inserir histórico de score" ON public.clientes_score_historico;
DROP POLICY IF EXISTS "Financeiro pode ver histórico de score" ON public.clientes_score_historico;
CREATE POLICY "Financeiro pode ver histórico de score" ON public.clientes_score_historico FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));
CREATE POLICY "Financeiro pode inserir histórico de score" ON public.clientes_score_historico FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));

-- cnpjbiz_audit
DROP POLICY IF EXISTS "Usuários podem ver própria auditoria" ON public.cnpjbiz_audit;
CREATE POLICY "Usuários podem ver própria auditoria" ON public.cnpjbiz_audit FOR SELECT TO authenticated USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- cobranca_execucao_log
DROP POLICY IF EXISTS "Admins podem ver logs de execução" ON public.cobranca_execucao_log;
CREATE POLICY "Admins podem ver logs de execução" ON public.cobranca_execucao_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));
