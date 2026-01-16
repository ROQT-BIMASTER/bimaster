
-- =====================================================
-- CORREÇÃO DE SEGURANÇA - TABELAS SENSÍVEIS RESTANTES
-- =====================================================

-- VISITS - Apenas promotores, vendedores, supervisores, admin
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view visits" ON public.visits;
DROP POLICY IF EXISTS "Users can view own visits" ON public.visits;

CREATE POLICY "Users can view visits based on role"
ON public.visits FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'trade')
);

CREATE POLICY "Users can insert own visits"
ON public.visits FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Users can update own visits"
ON public.visits FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can delete visits"
ON public.visits FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- NOTIFICATIONS - Usuário vê apenas próprias notificações
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- USER_ROLES - Apenas admin pode gerenciar
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Users can view own role or admins all"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ATIVIDADES - Vendedor vê próprias, supervisor vê equipe
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view atividades" ON public.atividades;

CREATE POLICY "Users can view atividades based on role"
ON public.atividades FOR SELECT
TO authenticated
USING (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'vendas')
);

CREATE POLICY "Users can insert atividades"
ON public.atividades FOR INSERT
TO authenticated
WITH CHECK (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Users can update own atividades"
ON public.atividades FOR UPDATE
TO authenticated
USING (
  vendedor_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

CREATE POLICY "Admins can delete atividades"
ON public.atividades FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor')
);

-- ADS_CAMPAIGNS - Mesmo acesso que ads_accounts
ALTER TABLE public.ads_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view campaigns" ON public.ads_campaigns;

CREATE POLICY "Marketing can view campaigns"
ON public.ads_campaigns FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

CREATE POLICY "Marketing can insert campaigns"
ON public.ads_campaigns FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

CREATE POLICY "Marketing can update campaigns"
ON public.ads_campaigns FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

CREATE POLICY "Admins can delete campaigns"
ON public.ads_campaigns FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ADS_METRICS - Mesmo acesso que ads_accounts
ALTER TABLE public.ads_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view metrics" ON public.ads_metrics;

CREATE POLICY "Marketing can view metrics"
ON public.ads_metrics FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

CREATE POLICY "Marketing can insert metrics"
ON public.ads_metrics FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

CREATE POLICY "Marketing can update metrics"
ON public.ads_metrics FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

-- ADS_CAMPAIGN_METRICS - Mesmo acesso
ALTER TABLE public.ads_campaign_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view campaign metrics" ON public.ads_campaign_metrics;

CREATE POLICY "Marketing can view campaign metrics"
ON public.ads_campaign_metrics FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'supervisor') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

CREATE POLICY "Marketing can insert campaign metrics"
ON public.ads_campaign_metrics FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

CREATE POLICY "Marketing can update campaign metrics"
ON public.ads_campaign_metrics FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.usuario_tem_acesso_modulo(auth.uid(), 'marketing')
);

-- Revogar acesso anônimo
REVOKE ALL ON public.visits FROM anon;
REVOKE ALL ON public.notifications FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.atividades FROM anon;
REVOKE ALL ON public.ads_campaigns FROM anon;
REVOKE ALL ON public.ads_metrics FROM anon;
REVOKE ALL ON public.ads_campaign_metrics FROM anon;
