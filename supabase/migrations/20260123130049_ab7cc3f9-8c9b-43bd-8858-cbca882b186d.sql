-- Remover índice natural conflitante para permitir upsert por erp_id
-- Conforme documentado: erp_id é a chave única primária para sincronizações
DROP INDEX IF EXISTS idx_contas_receber_unique_natural;