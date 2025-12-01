-- Fase 1: Adicionar plano_contas_id à tabela contas_pagar
ALTER TABLE contas_pagar 
ADD COLUMN IF NOT EXISTS plano_contas_id UUID REFERENCES trade_chart_of_accounts(id);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_plano_contas ON contas_pagar(plano_contas_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_classificacao ON contas_pagar(departamento_id, plano_contas_id);

-- Fase 4: Criar tabela de mapeamentos aprendidos
CREATE TABLE IF NOT EXISTS account_classification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_nome TEXT NOT NULL,
  fornecedor_nome TEXT,
  tipo_documento TEXT,
  plano_contas_id UUID REFERENCES trade_chart_of_accounts(id),
  departamento_id UUID REFERENCES departamentos(id),
  confidence_score DECIMAL(3,2),
  times_used INTEGER DEFAULT 1,
  last_used_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  UNIQUE(categoria_nome, fornecedor_nome, tipo_documento)
);

CREATE INDEX IF NOT EXISTS idx_classification_rules_lookup 
ON account_classification_rules(categoria_nome, fornecedor_nome, tipo_documento);

COMMENT ON TABLE account_classification_rules IS 'Mapeamentos aprendidos de classificações para acelerar futuras classificações';
COMMENT ON COLUMN account_classification_rules.times_used IS 'Contador de quantas vezes essa regra foi aplicada';
COMMENT ON COLUMN account_classification_rules.confidence_score IS 'Score de confiança da classificação (0-1)';