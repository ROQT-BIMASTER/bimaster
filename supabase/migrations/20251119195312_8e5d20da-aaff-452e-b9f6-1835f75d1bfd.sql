-- Melhorias na tabela de fórmulas
ALTER TABLE fabrica_formulas ADD COLUMN IF NOT EXISTS rendimento_teorico NUMERIC DEFAULT 100;
ALTER TABLE fabrica_formulas ADD COLUMN IF NOT EXISTS rendimento_real NUMERIC;
ALTER TABLE fabrica_formulas ADD COLUMN IF NOT EXISTS perdas_esperadas NUMERIC DEFAULT 0;
ALTER TABLE fabrica_formulas ADD COLUMN IF NOT EXISTS tempo_producao_minutos INTEGER;
ALTER TABLE fabrica_formulas ADD COLUMN IF NOT EXISTS temperatura_ideal NUMERIC;
ALTER TABLE fabrica_formulas ADD COLUMN IF NOT EXISTS ph_ideal NUMERIC;
ALTER TABLE fabrica_formulas ADD COLUMN IF NOT EXISTS observacoes_tecnicas TEXT;

-- Melhorias na tabela de itens de fórmula
ALTER TABLE fabrica_formula_itens ADD COLUMN IF NOT EXISTS ordem_adicao INTEGER DEFAULT 1;
ALTER TABLE fabrica_formula_itens ADD COLUMN IF NOT EXISTS criticidade VARCHAR(20) DEFAULT 'importante';
ALTER TABLE fabrica_formula_itens ADD COLUMN IF NOT EXISTS permite_substituicao BOOLEAN DEFAULT false;
ALTER TABLE fabrica_formula_itens ADD COLUMN IF NOT EXISTS mp_alternativa_id UUID REFERENCES fabrica_materias_primas(id);
ALTER TABLE fabrica_formula_itens ADD COLUMN IF NOT EXISTS observacoes_tecnicas TEXT;

-- Nova: Versionamento de fórmulas
CREATE TABLE IF NOT EXISTS fabrica_formula_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID REFERENCES fabrica_formulas(id) ON DELETE CASCADE,
  versao_anterior_id UUID REFERENCES fabrica_formula_versoes(id),
  versao_numero INTEGER NOT NULL,
  alterado_por UUID REFERENCES profiles(id),
  data_alteracao TIMESTAMP DEFAULT now(),
  motivo_alteracao TEXT,
  changelog JSONB,
  aprovada_por UUID REFERENCES profiles(id),
  data_aprovacao TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pendente',
  created_at TIMESTAMP DEFAULT now()
);

-- Nova: Histórico de alterações de MPs em fórmulas
CREATE TABLE IF NOT EXISTS fabrica_formula_alteracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID REFERENCES fabrica_formulas(id) ON DELETE CASCADE,
  tipo_alteracao VARCHAR(50),
  mp_anterior_id UUID REFERENCES fabrica_materias_primas(id),
  mp_nova_id UUID REFERENCES fabrica_materias_primas(id),
  quantidade_anterior NUMERIC,
  quantidade_nova NUMERIC,
  motivo TEXT,
  usuario_id UUID REFERENCES profiles(id),
  data_alteracao TIMESTAMP DEFAULT now()
);

-- RLS Policies para fabrica_formula_versoes
ALTER TABLE fabrica_formula_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários com permissão fabrica podem ver versões"
  ON fabrica_formula_versoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar versões"
  ON fabrica_formula_versoes FOR INSERT
  WITH CHECK (
    alterado_por = auth.uid() AND
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admins e supervisores aprovam versões"
  ON fabrica_formula_versoes FOR UPDATE
  USING (is_admin_or_supervisor(auth.uid()));

-- RLS Policies para fabrica_formula_alteracoes
ALTER TABLE fabrica_formula_alteracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários com permissão fabrica podem ver alterações"
  ON fabrica_formula_alteracoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Sistema registra alterações"
  ON fabrica_formula_alteracoes FOR INSERT
  WITH CHECK (usuario_id = auth.uid());