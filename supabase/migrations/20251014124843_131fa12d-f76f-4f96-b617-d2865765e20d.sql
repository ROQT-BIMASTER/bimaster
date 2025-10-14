-- ============================================
-- FASE 1: CORREÇÕES CRÍTICAS DE SEGURANÇA
-- ============================================

-- 1. CORRIGIR RLS DA TABELA PROFILES
-- Remover políticas permissivas e adicionar restrições adequadas
DROP POLICY IF EXISTS "Acesso total profiles - SELECT" ON public.profiles;
DROP POLICY IF EXISTS "Acesso total profiles - UPDATE" ON public.profiles;

-- Usuários podem ver apenas seu próprio perfil (admins/supervisores veem todos)
CREATE POLICY "Usuários podem ver próprio perfil ou admins/supervisores veem todos"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

-- Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "Usuários podem atualizar próprio perfil"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admins e supervisores podem atualizar qualquer perfil
CREATE POLICY "Admins e supervisores podem atualizar perfis"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- 2. CORRIGIR RLS DA TABELA VISITS
-- Remover política permissiva
DROP POLICY IF EXISTS "Acesso total visits" ON public.visits;

-- Usuários podem ver suas próprias visitas
CREATE POLICY "Usuários podem ver próprias visitas"
ON public.visits
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

-- Usuários podem criar suas próprias visitas
CREATE POLICY "Usuários podem criar próprias visitas"
ON public.visits
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Usuários podem atualizar suas próprias visitas
CREATE POLICY "Usuários podem atualizar próprias visitas"
ON public.visits
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

-- Apenas admins podem deletar visitas
CREATE POLICY "Apenas admins podem deletar visitas"
ON public.visits
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 3. ADICIONAR POLÍTICAS DE ESCRITA PARA ASSINATURAS
CREATE POLICY "Admins podem criar assinaturas"
ON public.assinaturas
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar assinaturas"
ON public.assinaturas
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem deletar assinaturas"
ON public.assinaturas
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 4. RESTRINGIR TABELAS DE TRADE MARKETING
-- Tabela STORES
DROP POLICY IF EXISTS "Acesso total stores" ON public.stores;

CREATE POLICY "Usuários autenticados podem ver lojas"
ON public.stores
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins e supervisores podem gerenciar lojas"
ON public.stores
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- Tabela PRODUCTS
DROP POLICY IF EXISTS "Acesso total products" ON public.products;

CREATE POLICY "Usuários autenticados podem ver produtos"
ON public.products
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins e supervisores podem gerenciar produtos"
ON public.products
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- Tabela PHOTOS
DROP POLICY IF EXISTS "Acesso total photos" ON public.photos;

CREATE POLICY "Usuários autenticados podem ver fotos"
ON public.photos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem criar fotos"
ON public.photos
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar fotos"
ON public.photos
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Apenas admins podem deletar fotos"
ON public.photos
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Tabela COMPETITOR_INTELLIGENCE
DROP POLICY IF EXISTS "Acesso total competitor_intelligence" ON public.competitor_intelligence;

CREATE POLICY "Usuários autenticados podem ver inteligência competitiva"
ON public.competitor_intelligence
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem registrar inteligência"
ON public.competitor_intelligence
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Apenas admins e supervisores gerenciam inteligência competitiva"
ON public.competitor_intelligence
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- Tabela PROMOTIONS
DROP POLICY IF EXISTS "Acesso total promotions" ON public.promotions;

CREATE POLICY "Usuários autenticados podem ver promoções"
ON public.promotions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins e supervisores podem gerenciar promoções"
ON public.promotions
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- Tabela TRADE_INVESTMENTS
DROP POLICY IF EXISTS "Acesso total trade_investments" ON public.trade_investments;

CREATE POLICY "Usuários podem ver próprios investimentos"
ON public.trade_investments
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Usuários podem criar investimentos"
ON public.trade_investments
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Apenas admins e supervisores podem gerenciar investimentos"
ON public.trade_investments
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- Tabela SHELF_SHARE
DROP POLICY IF EXISTS "Acesso total shelf_share" ON public.shelf_share;

CREATE POLICY "Usuários autenticados podem ver shelf share"
ON public.shelf_share
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários autenticados podem registrar shelf share"
ON public.shelf_share
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Apenas admins e supervisores gerenciam shelf share"
ON public.shelf_share
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- Tabela GONDOLA_AUDITS
DROP POLICY IF EXISTS "Acesso total gondola_audits" ON public.gondola_audits;

CREATE POLICY "Usuários podem ver próprias auditorias"
ON public.gondola_audits
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Usuários podem criar auditorias"
ON public.gondola_audits
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Apenas admins e supervisores gerenciam auditorias"
ON public.gondola_audits
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- Outras tabelas de trade marketing
DROP POLICY IF EXISTS "Acesso total competitors" ON public.competitors;
DROP POLICY IF EXISTS "Acesso total promotion_execution" ON public.promotion_execution;
DROP POLICY IF EXISTS "Acesso total routes" ON public.routes;
DROP POLICY IF EXISTS "Acesso total kpis_tracking" ON public.kpis_tracking;
DROP POLICY IF EXISTS "Acesso total ideal_pdv_photos" ON public.ideal_pdv_photos;
DROP POLICY IF EXISTS "Acesso total competitor_comparison_photos" ON public.competitor_comparison_photos;
DROP POLICY IF EXISTS "Acesso total trade_budgets" ON public.trade_budgets;
DROP POLICY IF EXISTS "Acesso total trade_chart_of_accounts" ON public.trade_chart_of_accounts;
DROP POLICY IF EXISTS "Acesso total trade_financial_entries" ON public.trade_financial_entries;

-- COMPETITORS
CREATE POLICY "Usuários autenticados podem ver concorrentes"
ON public.competitors
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins e supervisores gerenciam concorrentes"
ON public.competitors
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- PROMOTION_EXECUTION
CREATE POLICY "Usuários podem ver execuções de promoção"
ON public.promotion_execution
FOR SELECT
TO authenticated
USING (
  checked_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Usuários podem registrar execuções"
ON public.promotion_execution
FOR INSERT
TO authenticated
WITH CHECK (checked_by = auth.uid());

CREATE POLICY "Apenas admins e supervisores gerenciam execuções"
ON public.promotion_execution
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- ROUTES
CREATE POLICY "Usuários podem ver próprias rotas"
ON public.routes
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Usuários podem criar próprias rotas"
ON public.routes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar próprias rotas"
ON public.routes
FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Apenas admins podem deletar rotas"
ON public.routes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- KPIS_TRACKING, IDEAL_PDV_PHOTOS, COMPETITOR_COMPARISON_PHOTOS
CREATE POLICY "Usuários autenticados podem ver KPIs"
ON public.kpis_tracking
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins e supervisores gerenciam KPIs"
ON public.kpis_tracking
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários autenticados podem ver fotos ideais PDV"
ON public.ideal_pdv_photos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins e supervisores gerenciam fotos ideais"
ON public.ideal_pdv_photos
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários autenticados podem ver fotos comparação"
ON public.competitor_comparison_photos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuários podem criar fotos comparação"
ON public.competitor_comparison_photos
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Apenas admins e supervisores gerenciam fotos comparação"
ON public.competitor_comparison_photos
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- TRADE FINANCIAL TABLES
CREATE POLICY "Usuários autenticados podem ver orçamentos"
ON public.trade_budgets
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins gerenciam orçamentos"
ON public.trade_budgets
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários autenticados podem ver plano de contas"
ON public.trade_chart_of_accounts
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins gerenciam plano de contas"
ON public.trade_chart_of_accounts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários podem ver próprias entradas financeiras"
ON public.trade_financial_entries
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Usuários podem criar entradas financeiras"
ON public.trade_financial_entries
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Apenas admins e supervisores gerenciam entradas financeiras"
ON public.trade_financial_entries
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));