CREATE TABLE IF NOT EXISTS public.user_central_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_tab text NOT NULL DEFAULT 'hoje',
  default_view text NOT NULL DEFAULT 'list',
  default_filter text NOT NULL DEFAULT 'all',
  default_priority text NOT NULL DEFAULT 'all',
  default_project text NOT NULL DEFAULT 'all',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_central_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own central preferences"
  ON public.user_central_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own central preferences"
  ON public.user_central_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own central preferences"
  ON public.user_central_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own central preferences"
  ON public.user_central_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_central_preferences()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_user_central_preferences ON public.user_central_preferences;
CREATE TRIGGER trg_touch_user_central_preferences
  BEFORE UPDATE ON public.user_central_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_central_preferences();