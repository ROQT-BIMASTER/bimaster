
CREATE OR REPLACE FUNCTION public.can_access_huggs_studio(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'marketing'::app_role);
$$;

CREATE TABLE public.huggs_studio_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  titulo text NOT NULL,
  script text,
  avatar_id uuid,
  voice_id uuid,
  brand_kit_id text,
  heygen_video_id text,
  status text NOT NULL DEFAULT 'pending',
  video_url text,
  thumbnail_url text,
  duration_seconds numeric,
  language text DEFAULT 'pt',
  source_type text NOT NULL DEFAULT 'avatar',
  source_video_id uuid,
  error_message text,
  is_agency_shared boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_huggs_videos_user ON public.huggs_studio_videos(user_id);
CREATE INDEX idx_huggs_videos_status ON public.huggs_studio_videos(status);
CREATE INDEX idx_huggs_videos_heygen ON public.huggs_studio_videos(heygen_video_id);
ALTER TABLE public.huggs_studio_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "huggs_videos_select" ON public.huggs_studio_videos
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR (is_agency_shared AND public.can_access_huggs_studio(auth.uid())) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "huggs_videos_insert" ON public.huggs_studio_videos
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.can_access_huggs_studio(auth.uid()));
CREATE POLICY "huggs_videos_update" ON public.huggs_studio_videos
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "huggs_videos_delete" ON public.huggs_studio_videos
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.huggs_studio_avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'photo',
  heygen_avatar_group_id text,
  heygen_avatar_look_id text,
  preview_url text,
  status text NOT NULL DEFAULT 'pending',
  consent_url text,
  is_agency_shared boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_huggs_avatars_user ON public.huggs_studio_avatars(user_id);
ALTER TABLE public.huggs_studio_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "huggs_avatars_select" ON public.huggs_studio_avatars
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR (is_agency_shared AND public.can_access_huggs_studio(auth.uid())) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "huggs_avatars_insert" ON public.huggs_studio_avatars
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.can_access_huggs_studio(auth.uid()));
CREATE POLICY "huggs_avatars_update" ON public.huggs_studio_avatars
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "huggs_avatars_delete" ON public.huggs_studio_avatars
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.huggs_studio_voices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'clone',
  heygen_voice_id text,
  language text DEFAULT 'pt',
  gender text,
  preview_url text,
  status text NOT NULL DEFAULT 'pending',
  is_agency_shared boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_huggs_voices_user ON public.huggs_studio_voices(user_id);
ALTER TABLE public.huggs_studio_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "huggs_voices_select" ON public.huggs_studio_voices
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR (is_agency_shared AND public.can_access_huggs_studio(auth.uid())) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "huggs_voices_insert" ON public.huggs_studio_voices
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.can_access_huggs_studio(auth.uid()));
CREATE POLICY "huggs_voices_update" ON public.huggs_studio_voices
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "huggs_voices_delete" ON public.huggs_studio_voices
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.huggs_studio_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_video_id uuid,
  source_url text,
  target_language text NOT NULL,
  heygen_translation_id text,
  status text NOT NULL DEFAULT 'pending',
  video_url text,
  title text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_huggs_translations_user ON public.huggs_studio_translations(user_id);
ALTER TABLE public.huggs_studio_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "huggs_translations_select" ON public.huggs_studio_translations
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "huggs_translations_insert" ON public.huggs_studio_translations
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.can_access_huggs_studio(auth.uid()));
CREATE POLICY "huggs_translations_update" ON public.huggs_studio_translations
FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "huggs_translations_delete" ON public.huggs_studio_translations
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.huggs_studio_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mes text NOT NULL,
  minutos_gerados numeric NOT NULL DEFAULT 0,
  custo_estimado_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes)
);
ALTER TABLE public.huggs_studio_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "huggs_usage_select" ON public.huggs_studio_usage
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_huggs_videos_updated BEFORE UPDATE ON public.huggs_studio_videos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_huggs_avatars_updated BEFORE UPDATE ON public.huggs_studio_avatars
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_huggs_voices_updated BEFORE UPDATE ON public.huggs_studio_voices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_huggs_translations_updated BEFORE UPDATE ON public.huggs_studio_translations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_huggs_usage_updated BEFORE UPDATE ON public.huggs_studio_usage
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
