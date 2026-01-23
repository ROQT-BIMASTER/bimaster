-- Adicionar coluna para múltiplas evidências se não existir
ALTER TABLE trade_campaign_expenses 
ADD COLUMN IF NOT EXISTS evidencias JSONB DEFAULT '[]'::jsonb;

-- Comentário
COMMENT ON COLUMN trade_campaign_expenses.evidencias IS 'Array de URLs de evidências adicionais (fotos, comprovantes)';