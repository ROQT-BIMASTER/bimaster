ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS ata text;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS participants jsonb;