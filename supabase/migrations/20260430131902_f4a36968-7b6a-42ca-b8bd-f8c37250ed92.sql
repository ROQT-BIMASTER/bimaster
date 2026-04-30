ALTER TABLE public.user_central_preferences
ADD COLUMN IF NOT EXISTS default_role text NOT NULL DEFAULT 'all';