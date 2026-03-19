ALTER TABLE erp_sync_log
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS evento TEXT,
  ADD COLUMN IF NOT EXISTS referencia_erp TEXT,
  ADD COLUMN IF NOT EXISTS conta_pagar_id UUID REFERENCES contas_pagar(id),
  ADD COLUMN IF NOT EXISTS payload_entrada JSONB,
  ADD COLUMN IF NOT EXISTS fila_atualizada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS data_processamento_erp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erp_mensagem TEXT,
  ADD COLUMN IF NOT EXISTS erp_codigo_erro TEXT;

CREATE INDEX IF NOT EXISTS idx_erp_sync_log_idempotency
  ON erp_sync_log (empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_erp_sync_log_referencia_erp
  ON erp_sync_log (empresa_id, referencia_erp)
  WHERE referencia_erp IS NOT NULL;