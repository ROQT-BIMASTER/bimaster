-- Adicionar campos para controle de classificação manual
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS classificacao_manual BOOLEAN DEFAULT FALSE;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS classificacao_corrigida_por UUID;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS classificacao_corrigida_em TIMESTAMP WITH TIME ZONE;

-- Comentários para documentação
COMMENT ON COLUMN contas_pagar.classificacao_manual IS 'Se true, impede reclassificação automática pela IA';
COMMENT ON COLUMN contas_pagar.classificacao_corrigida_por IS 'ID do usuário que fez a correção manual';
COMMENT ON COLUMN contas_pagar.classificacao_corrigida_em IS 'Data/hora da correção manual';