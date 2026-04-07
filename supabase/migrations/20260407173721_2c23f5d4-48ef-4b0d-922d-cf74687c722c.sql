
-- Tabela de influenciadores monitorados
CREATE TABLE public.influencers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phyllo_account_id TEXT,
  platform TEXT NOT NULL DEFAULT 'instagram',
  username TEXT NOT NULL,
  display_name TEXT,
  profile_url TEXT,
  avatar_url TEXT,
  followers_count INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  avg_likes INTEGER DEFAULT 0,
  avg_comments INTEGER DEFAULT 0,
  audience_data JSONB DEFAULT '{}'::jsonb,
  fraud_score NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'active',
  last_synced_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own influencers"
  ON public.influencers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own influencers"
  ON public.influencers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own influencers"
  ON public.influencers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own influencers"
  ON public.influencers FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_influencers_user_id ON public.influencers(user_id);
CREATE INDEX idx_influencers_platform ON public.influencers(platform);

-- Tabela de campanhas de influenciadores
CREATE TABLE public.influencer_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  campaign_name TEXT NOT NULL,
  platform TEXT,
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12,2) DEFAULT 0,
  spent NUMERIC(12,2) DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  roi NUMERIC(8,2),
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaigns"
  ON public.influencer_campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
  ON public.influencer_campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON public.influencer_campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
  ON public.influencer_campaigns FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_influencer_campaigns_user_id ON public.influencer_campaigns(user_id);
CREATE INDEX idx_influencer_campaigns_influencer_id ON public.influencer_campaigns(influencer_id);

-- Triggers de updated_at
CREATE TRIGGER update_influencers_updated_at
  BEFORE UPDATE ON public.influencers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_influencer_campaigns_updated_at
  BEFORE UPDATE ON public.influencer_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
