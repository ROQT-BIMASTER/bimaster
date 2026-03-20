-- FIX2: Índices de performance para queries ERP e financeiras
-- Nota: CONCURRENTLY não é possível dentro de transação de migration,
-- usando CREATE INDEX IF NOT EXISTS (lock breve em tabelas pequenas)

CREATE INDEX IF NOT EXISTS idx_erp_sync_log_empresa_criado 
  ON erp_sync_log(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_erp_sync_log_idempotencia 
  ON erp_sync_log(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa_status 
  ON contas_pagar(empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_pluggy 
  ON contas_pagar(pluggy_transaction_id) 
  WHERE pluggy_transaction_id IS NOT NULL;