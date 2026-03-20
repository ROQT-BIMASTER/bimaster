
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS importado_api BOOLEAN DEFAULT false;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS codigo_integracao TEXT;
