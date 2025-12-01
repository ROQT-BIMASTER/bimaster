-- Add cache columns to contas_pagar for faster display
ALTER TABLE contas_pagar 
  ADD COLUMN IF NOT EXISTS departamento_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS plano_contas_codigo VARCHAR(50),
  ADD COLUMN IF NOT EXISTS plano_contas_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS classificacao_justificativa TEXT,
  ADD COLUMN IF NOT EXISTS classificado_em TIMESTAMP WITH TIME ZONE;

-- Create index for filtering by classification date
CREATE INDEX IF NOT EXISTS idx_contas_pagar_classificado_em 
  ON contas_pagar(classificado_em) 
  WHERE classificado_em IS NOT NULL;

-- Create index for filtering classified accounts
CREATE INDEX IF NOT EXISTS idx_contas_pagar_classificado 
  ON contas_pagar(classificado_automaticamente) 
  WHERE classificado_automaticamente = true;