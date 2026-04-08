CREATE TABLE public.influencer_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  influencer_id UUID REFERENCES public.influencers(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'opportunity',
  title TEXT NOT NULL,
  description TEXT,
  score NUMERIC,
  alert_type TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  metadata JSONB DEFAULT '{}',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_influencer_opportunities_user ON public.influencer_opportunities(user_id);
CREATE INDEX idx_influencer_opportunities_status ON public.influencer_opportunities(status);
CREATE INDEX idx_influencer_opportunities_type ON public.influencer_opportunities(type);

ALTER TABLE public.influencer_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own opportunities"
ON public.influencer_opportunities FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own opportunities"
ON public.influencer_opportunities FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own opportunities"
ON public.influencer_opportunities FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);