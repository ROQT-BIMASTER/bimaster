
-- influencer_posts
CREATE TABLE public.influencer_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  platform_post_id TEXT,
  post_url TEXT,
  post_type TEXT DEFAULT 'image',
  caption TEXT,
  thumbnail_url TEXT,
  likes INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  posted_at TIMESTAMPTZ,
  ai_content_analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own influencer posts" ON public.influencer_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own influencer posts" ON public.influencer_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own influencer posts" ON public.influencer_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own influencer posts" ON public.influencer_posts FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_influencer_posts_influencer ON public.influencer_posts(influencer_id);
CREATE INDEX idx_influencer_posts_user ON public.influencer_posts(user_id);

-- influencer_comments
CREATE TABLE public.influencer_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.influencer_posts(id) ON DELETE CASCADE,
  author_username TEXT,
  comment_text TEXT,
  sentiment TEXT DEFAULT 'neutral',
  sentiment_score NUMERIC(3,2) DEFAULT 0,
  is_spam BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_comments ENABLE ROW LEVEL SECURITY;

-- Access through post ownership
CREATE POLICY "Users can view comments on own posts" ON public.influencer_comments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.influencer_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can create comments on own posts" ON public.influencer_comments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.influencer_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can update comments on own posts" ON public.influencer_comments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.influencer_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));
CREATE POLICY "Users can delete comments on own posts" ON public.influencer_comments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.influencer_posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

CREATE INDEX idx_influencer_comments_post ON public.influencer_comments(post_id);

-- influencer_analyses
CREATE TABLE public.influencer_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  analysis_type TEXT NOT NULL DEFAULT 'full_360',
  result JSONB NOT NULL DEFAULT '{}',
  ai_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON public.influencer_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own analyses" ON public.influencer_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own analyses" ON public.influencer_analyses FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_influencer_analyses_influencer ON public.influencer_analyses(influencer_id);
CREATE INDEX idx_influencer_analyses_user ON public.influencer_analyses(user_id);
