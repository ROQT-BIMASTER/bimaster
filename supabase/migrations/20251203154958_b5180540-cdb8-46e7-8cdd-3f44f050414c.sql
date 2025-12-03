-- Adicionar campo para controlar se o lançamento está ativo no DRE
ALTER TABLE public.contas_pagar 
ADD COLUMN IF NOT EXISTS ativo_dre BOOLEAN DEFAULT true;

-- Adicionar índice para performance nas consultas
CREATE INDEX IF NOT EXISTS idx_contas_pagar_ativo_dre ON public.contas_pagar (ativo_dre);

-- Comentário
COMMENT ON COLUMN public.contas_pagar.ativo_dre IS 'Controla se o lançamento entra ou não nos cálculos do DRE';