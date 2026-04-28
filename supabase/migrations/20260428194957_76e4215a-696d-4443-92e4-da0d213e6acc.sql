
ALTER TABLE public.influencer_comments
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'apify';

CREATE INDEX IF NOT EXISTS idx_influencer_comments_post_sentiment
  ON public.influencer_comments(post_id, sentiment);

CREATE INDEX IF NOT EXISTS idx_influencer_posts_source
  ON public.influencer_posts(influencer_id, source);
