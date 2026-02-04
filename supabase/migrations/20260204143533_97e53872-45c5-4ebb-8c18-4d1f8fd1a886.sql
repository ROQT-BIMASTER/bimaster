-- Adicionar coluna classification na tabela stores
ALTER TABLE public.stores 
ADD COLUMN classification VARCHAR(2) DEFAULT 'C';

-- Índice para performance em filtros
CREATE INDEX idx_stores_classification ON public.stores(classification);

-- Comentário descritivo
COMMENT ON COLUMN public.stores.classification IS 
  'Classificação comercial do cliente: A+, A, B, C, D, E';