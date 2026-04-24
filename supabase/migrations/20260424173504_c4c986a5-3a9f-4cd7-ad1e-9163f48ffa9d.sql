ALTER TABLE public.user_central_preferences
  ADD COLUMN IF NOT EXISTS show_weekly_summary boolean NOT NULL DEFAULT true;