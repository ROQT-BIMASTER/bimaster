ALTER TABLE public.rr_produtos  RENAME COLUMN origem TO source_system;
ALTER TABLE public.rr_variantes RENAME COLUMN origem TO source_system;
ALTER TABLE public.rr_linhas ADD COLUMN IF NOT EXISTS source_system text NOT NULL DEFAULT 'notion';