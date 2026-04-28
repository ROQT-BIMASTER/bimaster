-- Influencers: campos enriquecidos da Apify
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_category text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS posts_count integer,
  ADD COLUMN IF NOT EXISTS following_count integer,
  ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_source text DEFAULT 'manual';

-- Posts: rastreia origem e mídia original
ALTER TABLE public.influencer_posts
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'phyllo';

-- Índice parcial para filtro "Só verificados"
CREATE INDEX IF NOT EXISTS idx_influencers_verified
  ON public.influencers (is_verified)
  WHERE is_verified = true;

-- Garantir unicidade para upsert de posts (idempotência por plataforma)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_influencer_posts_platform_id
  ON public.influencer_posts (influencer_id, platform_post_id)
  WHERE platform_post_id IS NOT NULL;