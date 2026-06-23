
-- 1. Cria tabela de preferências de UI por usuário (se não existir)
CREATE TABLE IF NOT EXISTS public.user_ui_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ui_preferences TO authenticated;
GRANT ALL ON public.user_ui_preferences TO service_role;

ALTER TABLE public.user_ui_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_ui_preferences'
      AND policyname='Users manage own UI preferences'
  ) THEN
    CREATE POLICY "Users manage own UI preferences"
      ON public.user_ui_preferences
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2. PR-Nav-0: feature flag de navegação v1/v2 (aditiva, idempotente)
ALTER TABLE public.user_ui_preferences
  ADD COLUMN IF NOT EXISTS nav_version text NOT NULL DEFAULT 'v1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_ui_preferences_nav_version_check'
  ) THEN
    ALTER TABLE public.user_ui_preferences
      ADD CONSTRAINT user_ui_preferences_nav_version_check
      CHECK (nav_version IN ('v1', 'v2'));
  END IF;
END $$;

COMMENT ON COLUMN public.user_ui_preferences.nav_version IS
  'Feature flag de navegação. v1 = sidebar clássica; v2 = AppRail + ContextualSidebar + Launcher. Default v1.';

-- 3. Trigger de updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_ui_preferences_updated_at ON public.user_ui_preferences;
CREATE TRIGGER trg_user_ui_preferences_updated_at
  BEFORE UPDATE ON public.user_ui_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
