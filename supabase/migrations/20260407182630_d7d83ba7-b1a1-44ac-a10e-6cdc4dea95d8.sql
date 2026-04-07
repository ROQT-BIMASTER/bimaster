
CREATE TABLE public.influencer_income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID REFERENCES public.influencers(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  platform TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'earning',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT,
  transaction_date TIMESTAMPTZ,
  payout_status TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own influencer income"
  ON public.influencer_income FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own influencer income"
  ON public.influencer_income FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own influencer income"
  ON public.influencer_income FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_influencer_income_influencer ON public.influencer_income(influencer_id);
CREATE INDEX idx_influencer_income_user ON public.influencer_income(user_id);
