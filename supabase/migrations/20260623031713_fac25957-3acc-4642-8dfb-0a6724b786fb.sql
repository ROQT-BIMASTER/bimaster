ALTER TABLE public.user_ui_preferences
  ADD COLUMN IF NOT EXISTS launcher_theme text NOT NULL DEFAULT 'dark'
  CHECK (launcher_theme IN ('dark','light'));