-- Add 'ativo' column to fabrica_materias_primas table
ALTER TABLE public.fabrica_materias_primas 
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;