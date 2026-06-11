CREATE TABLE IF NOT EXISTS public.user_view_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pref_key TEXT NOT NULL,
  pref_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pref_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_view_preferences TO authenticated;
GRANT ALL ON public.user_view_preferences TO service_role;

ALTER TABLE public.user_view_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own view prefs"
  ON public.user_view_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own view prefs"
  ON public.user_view_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own view prefs"
  ON public.user_view_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own view prefs"
  ON public.user_view_preferences
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());