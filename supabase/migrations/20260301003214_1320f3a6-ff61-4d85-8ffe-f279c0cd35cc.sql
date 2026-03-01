-- Add lote column to fabrica_revisao_documentos
ALTER TABLE public.fabrica_revisao_documentos 
ADD COLUMN IF NOT EXISTS lote TEXT DEFAULT NULL;