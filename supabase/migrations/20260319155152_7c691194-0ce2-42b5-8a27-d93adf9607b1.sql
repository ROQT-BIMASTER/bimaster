
CREATE TABLE IF NOT EXISTS portadores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresas(id),
  nome VARCHAR(100) NOT NULL,
  banco_codigo VARCHAR(10),
  banco_nome VARCHAR(100),
  agencia VARCHAR(20),
  conta VARCHAR(30),
  tipo VARCHAR(20),
  codigo_erp VARCHAR(50),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contas_pagar
  ADD COLUMN IF NOT EXISTS portador_id UUID REFERENCES portadores(id),
  ADD COLUMN IF NOT EXISTS portador_codigo_erp VARCHAR(50),
  ADD COLUMN IF NOT EXISTS data_competencia DATE,
  ADD COLUMN IF NOT EXISTS numero_parcela INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_parcelas INTEGER DEFAULT 1;
