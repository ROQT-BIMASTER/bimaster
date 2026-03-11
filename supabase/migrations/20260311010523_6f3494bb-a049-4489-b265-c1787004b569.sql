
ALTER TABLE bank_connections 
  ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
  ADD COLUMN IF NOT EXISTS saldo_atual NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_atualizado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_bank_connections_empresa ON bank_connections(empresa_id);
