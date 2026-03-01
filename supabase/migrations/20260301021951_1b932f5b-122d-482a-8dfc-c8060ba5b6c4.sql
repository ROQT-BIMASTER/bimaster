
-- Add fiscal columns to fabrica_materias_primas
ALTER TABLE public.fabrica_materias_primas
  ADD COLUMN IF NOT EXISTS ncm TEXT,
  ADD COLUMN IF NOT EXISTS cfop TEXT;
