-- Adicionar coluna para banner URL na tabela trade_rewards
ALTER TABLE trade_rewards ADD COLUMN IF NOT EXISTS banner_url TEXT;