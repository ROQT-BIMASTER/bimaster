-- Add metadata column for storing structured quotation data in cofre
ALTER TABLE public.fabrica_revisao_documentos 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;