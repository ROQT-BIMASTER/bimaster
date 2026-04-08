
-- Create influencer_company_profile table
CREATE TABLE public.influencer_company_profile (
  user_id uuid PRIMARY KEY,
  company_name text,
  segment text,
  target_audience text,
  brand_values text,
  products_services text,
  competitors text,
  preferred_platforms text[] DEFAULT '{}',
  budget_range text,
  campaign_goals text,
  brand_tone text,
  autopilot_enabled boolean DEFAULT false,
  autopilot_frequency text DEFAULT 'weekly',
  last_autopilot_run timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_company_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company profile"
  ON public.influencer_company_profile FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company profile"
  ON public.influencer_company_profile FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company profile"
  ON public.influencer_company_profile FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_influencer_company_profile_updated_at
  BEFORE UPDATE ON public.influencer_company_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add scoring columns to influencers
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS composite_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rank_position integer,
  ADD COLUMN IF NOT EXISTS opportunity_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_analyzed_at timestamptz;
