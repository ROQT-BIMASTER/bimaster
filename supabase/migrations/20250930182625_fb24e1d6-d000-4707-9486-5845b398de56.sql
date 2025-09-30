-- Adicionar novos campos na tabela prospects
ALTER TABLE public.prospects 
ADD COLUMN IF NOT EXISTS endereco TEXT,
ADD COLUMN IF NOT EXISTS porte_empresa TEXT CHECK (porte_empresa IN ('MEI', 'Micro', 'Pequena', 'Média', 'Grande'));

-- Criar índice para melhor performance em buscas por porte
CREATE INDEX IF NOT EXISTS idx_prospects_porte ON public.prospects(porte_empresa);