-- Adicionar coluna uf na tabela prospects
ALTER TABLE public.prospects 
ADD COLUMN IF NOT EXISTS uf TEXT;