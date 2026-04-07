
ALTER TABLE public.social_media_accounts
ADD COLUMN IF NOT EXISTS app_id TEXT,
ADD COLUMN IF NOT EXISTS app_secret_encrypted BYTEA;
