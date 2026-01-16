
-- =====================================================
-- CORREÇÃO - Política permissiva de notificações + tabelas críticas restantes
-- =====================================================

-- Corrigir política de INSERT em notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Admins or system can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- AUDIT_LOGS - Apenas admin pode ver
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

CREATE POLICY "Admins can view audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- AI_CALLS - Apenas vendedores e supervisores
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ai calls" ON public.ai_calls;

CREATE POLICY "Users can view own ai calls"
ON public.ai_calls FOR SELECT
TO authenticated
USING (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Users can insert ai calls"
ON public.ai_calls FOR INSERT
TO authenticated
WITH CHECK (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can update own ai calls"
ON public.ai_calls FOR UPDATE
TO authenticated
USING (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin')
);

-- AI_INSIGHTS - Apenas admin e supervisores
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view ai insights" ON public.ai_insights;

CREATE POLICY "Admins and supervisors can view ai insights"
ON public.ai_insights FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can manage ai insights"
ON public.ai_insights FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- COBRANCAS_ENVIADAS - Apenas financeiro
ALTER TABLE public.cobrancas_enviadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Finance can view cobrancas enviadas" ON public.cobrancas_enviadas;

CREATE POLICY "Finance can view cobrancas enviadas"
ON public.cobrancas_enviadas FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance can insert cobrancas enviadas"
ON public.cobrancas_enviadas FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

CREATE POLICY "Finance can update cobrancas enviadas"
ON public.cobrancas_enviadas FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'financeiro')
);

-- COMPETITOR_INTELLIGENCE - Trade e vendas
ALTER TABLE public.competitor_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view competitor intelligence" ON public.competitor_intelligence;

CREATE POLICY "Trade and sales can view competitor intelligence"
ON public.competitor_intelligence FOR SELECT
TO authenticated
USING (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Trade can insert competitor intelligence"
ON public.competitor_intelligence FOR INSERT
TO authenticated
WITH CHECK (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Trade can update competitor intelligence"
ON public.competitor_intelligence FOR UPDATE
TO authenticated
USING (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- COMPETITORS - Trade
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view competitors" ON public.competitors;

CREATE POLICY "Trade and admins can view competitors"
ON public.competitors FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Trade can insert competitors"
ON public.competitors FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Trade can update competitors"
ON public.competitors FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Admins can delete competitors"
ON public.competitors FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- COMPETITOR_PRODUCTS - Trade
ALTER TABLE public.competitor_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view competitor products" ON public.competitor_products;

CREATE POLICY "Trade and admins can view competitor products"
ON public.competitor_products FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Trade can insert competitor products"
ON public.competitor_products FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Trade can update competitor products"
ON public.competitor_products FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

-- GOALS - Vendas e supervisores
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view goals" ON public.goals;

CREATE POLICY "Users can view goals"
ON public.goals FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'vendas')
);

CREATE POLICY "Admins can manage goals"
ON public.goals FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- Revogar acesso anônimo
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.ai_calls FROM anon;
REVOKE ALL ON public.ai_insights FROM anon;
REVOKE ALL ON public.cobrancas_enviadas FROM anon;
REVOKE ALL ON public.competitor_intelligence FROM anon;
REVOKE ALL ON public.competitors FROM anon;
REVOKE ALL ON public.competitor_products FROM anon;
REVOKE ALL ON public.goals FROM anon;
