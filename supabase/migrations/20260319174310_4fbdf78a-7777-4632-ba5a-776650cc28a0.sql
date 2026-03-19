
-- AJUSTE 1: Novas colunas em contas_pagar
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS baixa_origem TEXT;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS data_baixa TIMESTAMPTZ;

-- Atualizar trigger para preservar status 'cancelado'
CREATE OR REPLACE FUNCTION calcular_status_conta_pagar()
RETURNS TRIGGER AS $$
BEGIN
  -- Preservar status 'cancelado' se definido explicitamente
  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;
  NEW.status := CASE 
    WHEN NEW.valor_aberto = 0 OR NEW.valor_aberto IS NULL THEN 'pago'
    WHEN NEW.valor_pago > 0 AND NEW.valor_aberto > 0 THEN 'parcial'
    WHEN NEW.data_vencimento < CURRENT_DATE AND NEW.valor_aberto > 0 THEN 'vencido'
    ELSE 'pendente'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
