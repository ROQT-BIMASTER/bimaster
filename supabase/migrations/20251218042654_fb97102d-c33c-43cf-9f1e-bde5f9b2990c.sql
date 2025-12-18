-- Tabela para contas de plataformas de ads
CREATE TABLE public.ads_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('google_ads', 'meta_ads', 'analytics', 'tiktok_ads', 'linkedin_ads')),
  account_name VARCHAR(255) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  credentials JSONB,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para métricas consolidadas de ads
CREATE TABLE public.ads_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(15,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(15,2) DEFAULT 0,
  ctr DECIMAL(8,4) DEFAULT 0,
  cpc DECIMAL(10,2) DEFAULT 0,
  cpm DECIMAL(10,2) DEFAULT 0,
  roas DECIMAL(10,2) DEFAULT 0,
  reach BIGINT DEFAULT 0,
  frequency DECIMAL(8,2) DEFAULT 0,
  video_views BIGINT DEFAULT 0,
  engagement INTEGER DEFAULT 0,
  campaign_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, metric_date)
);

-- Tabela para campanhas individuais
CREATE TABLE public.ads_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  campaign_id VARCHAR(255) NOT NULL,
  campaign_name VARCHAR(500) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  objective VARCHAR(100),
  budget_type VARCHAR(50),
  daily_budget DECIMAL(15,2),
  lifetime_budget DECIMAL(15,2),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para métricas de campanhas
CREATE TABLE public.ads_campaign_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.ads_campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  spend DECIMAL(15,2) DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_value DECIMAL(15,2) DEFAULT 0,
  ctr DECIMAL(8,4) DEFAULT 0,
  cpc DECIMAL(10,2) DEFAULT 0,
  reach BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, metric_date)
);

-- Tabela para métricas de Analytics (GA4)
CREATE TABLE public.analytics_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.ads_accounts(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  pageviews INTEGER DEFAULT 0,
  avg_session_duration DECIMAL(10,2) DEFAULT 0,
  bounce_rate DECIMAL(8,4) DEFAULT 0,
  pages_per_session DECIMAL(8,2) DEFAULT 0,
  goal_completions INTEGER DEFAULT 0,
  revenue DECIMAL(15,2) DEFAULT 0,
  transactions INTEGER DEFAULT 0,
  source_medium_data JSONB,
  device_data JSONB,
  geo_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, metric_date)
);

-- Habilitar RLS
ALTER TABLE public.ads_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads_campaign_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ads_accounts
CREATE POLICY "Users can view their own ads accounts" ON public.ads_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own ads accounts" ON public.ads_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own ads accounts" ON public.ads_accounts
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own ads accounts" ON public.ads_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para métricas (via account)
CREATE POLICY "Users can view metrics for their accounts" ON public.ads_metrics
  FOR SELECT USING (
    account_id IN (SELECT id FROM public.ads_accounts WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert metrics for their accounts" ON public.ads_metrics
  FOR INSERT WITH CHECK (
    account_id IN (SELECT id FROM public.ads_accounts WHERE user_id = auth.uid())
  );

-- Políticas RLS para campanhas
CREATE POLICY "Users can view campaigns for their accounts" ON public.ads_campaigns
  FOR SELECT USING (
    account_id IN (SELECT id FROM public.ads_accounts WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can manage campaigns for their accounts" ON public.ads_campaigns
  FOR ALL USING (
    account_id IN (SELECT id FROM public.ads_accounts WHERE user_id = auth.uid())
  );

-- Políticas RLS para métricas de campanhas
CREATE POLICY "Users can view campaign metrics" ON public.ads_campaign_metrics
  FOR SELECT USING (
    campaign_id IN (
      SELECT c.id FROM public.ads_campaigns c
      JOIN public.ads_accounts a ON c.account_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

-- Políticas RLS para analytics
CREATE POLICY "Users can view their analytics metrics" ON public.analytics_metrics
  FOR SELECT USING (
    account_id IN (SELECT id FROM public.ads_accounts WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can insert their analytics metrics" ON public.analytics_metrics
  FOR INSERT WITH CHECK (
    account_id IN (SELECT id FROM public.ads_accounts WHERE user_id = auth.uid())
  );

-- Índices para performance
CREATE INDEX idx_ads_accounts_user ON public.ads_accounts(user_id);
CREATE INDEX idx_ads_accounts_platform ON public.ads_accounts(platform);
CREATE INDEX idx_ads_metrics_date ON public.ads_metrics(metric_date);
CREATE INDEX idx_ads_metrics_account ON public.ads_metrics(account_id);
CREATE INDEX idx_ads_campaigns_account ON public.ads_campaigns(account_id);
CREATE INDEX idx_analytics_metrics_date ON public.analytics_metrics(metric_date);

-- Trigger para updated_at
CREATE TRIGGER update_ads_accounts_updated_at
  BEFORE UPDATE ON public.ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ads_campaigns_updated_at
  BEFORE UPDATE ON public.ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();