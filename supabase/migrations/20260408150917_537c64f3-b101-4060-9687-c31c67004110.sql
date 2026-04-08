
CREATE TABLE public.influencer_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  platform TEXT NOT NULL DEFAULT 'instagram',
  profile_url TEXT,
  followers_count INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  niche TEXT,
  reason TEXT,
  score NUMERIC(5,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own suggestions"
ON public.influencer_suggestions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suggestions"
ON public.influencer_suggestions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suggestions"
ON public.influencer_suggestions FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_influencer_suggestions_user_status ON public.influencer_suggestions(user_id, status);
