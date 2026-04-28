-- =========================
-- Cache de perfis Apify
-- =========================
CREATE TABLE IF NOT EXISTS public.discovered_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  username text NOT NULL,
  display_name text,
  profile_url text,
  avatar_url text,
  avatar_storage_path text,
  bio text,
  is_verified boolean DEFAULT false,
  is_private boolean DEFAULT false,
  business_category text,
  external_url text,
  niche text,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  engagement_rate numeric DEFAULT 0,
  avg_likes integer DEFAULT 0,
  avg_comments integer DEFAULT 0,
  latest_posts jsonb,
  raw_payload jsonb,
  data_source text DEFAULT 'apify',
  last_apify_sync_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_discovered_profile UNIQUE (platform, username)
);

CREATE INDEX IF NOT EXISTS idx_discovered_profiles_username ON public.discovered_profiles (username);
CREATE INDEX IF NOT EXISTS idx_discovered_profiles_expires ON public.discovered_profiles (expires_at);

ALTER TABLE public.discovered_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read discovered profiles"
ON public.discovered_profiles FOR SELECT
TO authenticated
USING (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_discovered_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_discovered_profiles_updated_at ON public.discovered_profiles;
CREATE TRIGGER trg_discovered_profiles_updated_at
BEFORE UPDATE ON public.discovered_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_discovered_profiles_updated_at();

-- =========================
-- Histórico/cache de buscas
-- =========================
CREATE TABLE IF NOT EXISTS public.discovery_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  query_normalized text NOT NULL,
  platform text,
  min_followers integer,
  max_followers integer,
  result_usernames jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_searches_lookup
  ON public.discovery_searches (query_normalized, platform, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_searches_user
  ON public.discovery_searches (user_id, created_at DESC);

ALTER TABLE public.discovery_searches ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ler o cache (por termo) — o cache é compartilhado.
CREATE POLICY "Authenticated users can read discovery searches"
ON public.discovery_searches FOR SELECT
TO authenticated
USING (true);

-- =========================
-- Mídia sob demanda em influencer_posts
-- =========================
ALTER TABLE public.influencer_posts
  ADD COLUMN IF NOT EXISTS thumbnail_storage_path text,
  ADD COLUMN IF NOT EXISTS media_storage_path text,
  ADD COLUMN IF NOT EXISTS media_ingested_at timestamptz;

-- =========================
-- Bucket privado para mídia
-- =========================
INSERT INTO storage.buckets (id, name, public)
VALUES ('influencer-media', 'influencer-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can read influencer-media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'influencer-media');
