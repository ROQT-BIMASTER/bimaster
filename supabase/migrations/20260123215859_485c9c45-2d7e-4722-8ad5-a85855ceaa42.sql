-- Adicionar novos campos para o layout do Home da Campanha
ALTER TABLE trade_campaigns 
ADD COLUMN IF NOT EXISTS valor_pedido NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tipo_brinde VARCHAR(255),
ADD COLUMN IF NOT EXISTS acoes_manuais TEXT,
ADD COLUMN IF NOT EXISTS unon_anterior NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS unon_atual NUMERIC(15,2) DEFAULT 0;

-- Comentários para documentação
COMMENT ON COLUMN trade_campaigns.valor_pedido IS 'Valor do pedido base da campanha';
COMMENT ON COLUMN trade_campaigns.tipo_brinde IS 'Descrição do brinde oferecido';
COMMENT ON COLUMN trade_campaigns.acoes_manuais IS 'Ações manuais registradas pelo usuário';
COMMENT ON COLUMN trade_campaigns.unon_anterior IS 'Valor Unon x Cliente do período anterior';
COMMENT ON COLUMN trade_campaigns.unon_atual IS 'Valor Unon x Cliente do período atual';