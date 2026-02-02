-- Adicionar campos de custo detalhado à tabela de itens da fórmula
ALTER TABLE fabrica_formula_itens
ADD COLUMN IF NOT EXISTS custo_nf DECIMAL(12,6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS custo_servico DECIMAL(12,6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS custo_condicao DECIMAL(12,6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS nf_referencia VARCHAR(50),
ADD COLUMN IF NOT EXISTS tipo_insumo VARCHAR(50);

-- Tabela de configuração de custos por fórmula
CREATE TABLE IF NOT EXISTS fabrica_ficha_custo_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID NOT NULL REFERENCES fabrica_formulas(id) ON DELETE CASCADE,
  custo_mao_obra DECIMAL(12,6) DEFAULT 0,
  fornecedor_mao_obra VARCHAR(100),
  percentual_markup DECIMAL(5,2) DEFAULT 10,
  custo_mao_obra_nf DECIMAL(12,6) DEFAULT 0,
  custo_mao_obra_servico DECIMAL(12,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(formula_id)
);

-- Enable RLS
ALTER TABLE fabrica_ficha_custo_config ENABLE ROW LEVEL SECURITY;

-- Policies for fabrica_ficha_custo_config
CREATE POLICY "Users can view ficha custo config"
ON fabrica_ficha_custo_config FOR SELECT
USING (true);

CREATE POLICY "Users can insert ficha custo config"
ON fabrica_ficha_custo_config FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update ficha custo config"
ON fabrica_ficha_custo_config FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete ficha custo config"
ON fabrica_ficha_custo_config FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_fabrica_ficha_custo_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_fabrica_ficha_custo_config_updated_at
BEFORE UPDATE ON fabrica_ficha_custo_config
FOR EACH ROW
EXECUTE FUNCTION update_fabrica_ficha_custo_config_updated_at();