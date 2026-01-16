
-- cobrancas
DROP POLICY IF EXISTS "cobrancas_select" ON public.cobrancas;
DROP POLICY IF EXISTS "cobrancas_update" ON public.cobrancas;
DROP POLICY IF EXISTS "cobrancas_insert" ON public.cobrancas;
CREATE POLICY "cobrancas_select_auth" ON public.cobrancas FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));
CREATE POLICY "cobrancas_update_auth" ON public.cobrancas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));
CREATE POLICY "cobrancas_insert_auth" ON public.cobrancas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));

-- cobrancas_enviadas  
DROP POLICY IF EXISTS "Admins e supervisores podem ver cobrancas enviadas" ON public.cobrancas_enviadas;
DROP POLICY IF EXISTS "Financeiro pode gerenciar cobrancas enviadas" ON public.cobrancas_enviadas;
CREATE POLICY "Financeiro pode ver cobrancas enviadas" ON public.cobrancas_enviadas FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));
CREATE POLICY "Financeiro pode gerenciar cobrancas enviadas" ON public.cobrancas_enviadas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));

-- competitor_comparison_photos
DROP POLICY IF EXISTS "Trade team can view competitor photos" ON public.competitor_comparison_photos;
DROP POLICY IF EXISTS "Trade team can add competitor photos" ON public.competitor_comparison_photos;
CREATE POLICY "Trade team can view competitor photos" ON public.competitor_comparison_photos FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'trade'));
CREATE POLICY "Trade team can add competitor photos" ON public.competitor_comparison_photos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'trade'));

-- competitor_intelligence
DROP POLICY IF EXISTS "Trade team and supervisors can view" ON public.competitor_intelligence;
DROP POLICY IF EXISTS "Trade team can add intelligence" ON public.competitor_intelligence;
CREATE POLICY "Trade team can view intelligence" ON public.competitor_intelligence FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'trade'));
CREATE POLICY "Trade team can add intelligence" ON public.competitor_intelligence FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'trade'));

-- competitor_products
DROP POLICY IF EXISTS "Trade and sales can view products" ON public.competitor_products;
DROP POLICY IF EXISTS "Supervisors can manage products" ON public.competitor_products;
CREATE POLICY "Trade and sales can view products" ON public.competitor_products FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'trade'));
CREATE POLICY "Supervisors can manage products" ON public.competitor_products FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- competitors
DROP POLICY IF EXISTS "Trade team can view competitors" ON public.competitors;
DROP POLICY IF EXISTS "Supervisors can manage competitors" ON public.competitors;
CREATE POLICY "Trade team can view competitors" ON public.competitors FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'trade'));
CREATE POLICY "Supervisors can manage competitors" ON public.competitors FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- contas_pagar
DROP POLICY IF EXISTS "contas_pagar_modify_restricted" ON public.contas_pagar;
DROP POLICY IF EXISTS "contas_pagar_select_restricted" ON public.contas_pagar;
CREATE POLICY "Financeiro pode ver contas pagar" ON public.contas_pagar FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));
CREATE POLICY "Financeiro pode gerenciar contas pagar" ON public.contas_pagar FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro')) WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR usuario_tem_acesso_modulo(auth.uid(), 'financeiro'));

-- contas_receber - já tem políticas, vamos garantir que estejam corretas
DROP POLICY IF EXISTS "contas_receber_modify_restricted" ON public.contas_receber;
DROP POLICY IF EXISTS "contas_receber_select_restricted" ON public.contas_receber;

-- departamentos
DROP POLICY IF EXISTS "Usuários podem ver departamentos" ON public.departamentos;
DROP POLICY IF EXISTS "Admins podem gerenciar departamentos" ON public.departamentos;
CREATE POLICY "Usuários podem ver departamentos" ON public.departamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerenciar departamentos" ON public.departamentos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- departamento_permissoes_modulos
DROP POLICY IF EXISTS "Admins podem gerenciar permissoes departamento modulos" ON public.departamento_permissoes_modulos;
DROP POLICY IF EXISTS "Usuários podem ver permissões de seu departamento" ON public.departamento_permissoes_modulos;
CREATE POLICY "Usuários podem ver permissões de departamento" ON public.departamento_permissoes_modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerenciar permissoes departamento modulos" ON public.departamento_permissoes_modulos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- departamento_permissoes_telas
DROP POLICY IF EXISTS "Admins podem gerenciar permissoes departamento telas" ON public.departamento_permissoes_telas;
DROP POLICY IF EXISTS "Usuários podem ver permissões de telas de seu departamento" ON public.departamento_permissoes_telas;
CREATE POLICY "Usuários podem ver permissões de telas de departamento" ON public.departamento_permissoes_telas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins podem gerenciar permissoes departamento telas" ON public.departamento_permissoes_telas FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
