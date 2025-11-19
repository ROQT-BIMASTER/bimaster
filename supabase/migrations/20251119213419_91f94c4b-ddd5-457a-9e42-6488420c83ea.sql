-- Criar tabela de regras fiscais padrão
CREATE TABLE IF NOT EXISTS fabrica_regras_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo_imposto TEXT NOT NULL CHECK (tipo_imposto IN ('ICMS', 'IPI', 'PIS', 'COFINS')),
  cfop TEXT NOT NULL,
  cst TEXT NOT NULL,
  aliquota DECIMAL(5,2) NOT NULL,
  base_calculo_reduzida DECIMAL(5,2),
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_fabrica_regras_fiscais_tipo ON fabrica_regras_fiscais(tipo_imposto);
CREATE INDEX idx_fabrica_regras_fiscais_ativo ON fabrica_regras_fiscais(ativo);
CREATE INDEX idx_fabrica_regras_fiscais_cfop ON fabrica_regras_fiscais(cfop);

-- Habilitar RLS
ALTER TABLE fabrica_regras_fiscais ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem visualizar regras fiscais"
  ON fabrica_regras_fiscais
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar regras fiscais"
  ON fabrica_regras_fiscais
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar regras fiscais"
  ON fabrica_regras_fiscais
  FOR UPDATE
  TO authenticated
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_fabrica_regras_fiscais_updated_at
  BEFORE UPDATE ON fabrica_regras_fiscais
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE fabrica_regras_fiscais IS 'Tabela de regras fiscais padrão para aplicação automática nos produtos';