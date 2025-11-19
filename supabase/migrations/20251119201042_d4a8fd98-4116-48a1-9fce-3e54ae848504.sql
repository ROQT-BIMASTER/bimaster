-- Tabela de Fornecedores (já existe, apenas garantir estrutura)
CREATE TABLE IF NOT EXISTS fabrica_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj VARCHAR(18) UNIQUE NOT NULL,
  razao_social VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255),
  endereco JSONB,
  contato VARCHAR(100),
  email VARCHAR(255),
  telefone VARCHAR(20),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Adicionar colunas faltantes se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fabrica_fornecedores' AND column_name='email') THEN
    ALTER TABLE fabrica_fornecedores ADD COLUMN email VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fabrica_fornecedores' AND column_name='telefone') THEN
    ALTER TABLE fabrica_fornecedores ADD COLUMN telefone VARCHAR(20);
  END IF;
END $$;

-- Tabela de Códigos de Fornecedor (mapeamento fornecedor→produto interno)
CREATE TABLE IF NOT EXISTS fabrica_codigos_fornecedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID REFERENCES fabrica_fornecedores(id) ON DELETE CASCADE,
  codigo_fornecedor VARCHAR(100) NOT NULL,
  descricao_fornecedor TEXT,
  produto_interno_id UUID REFERENCES fabrica_materias_primas(id) ON DELETE SET NULL,
  fator_conversao DECIMAL(10,4) DEFAULT 1.0,
  unidade_fornecedor VARCHAR(10),
  regras JSONB,
  score_confianca DECIMAL(3,2),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(fornecedor_id, codigo_fornecedor)
);

-- Tabela de Notas Fiscais
CREATE TABLE IF NOT EXISTS fabrica_notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_acesso VARCHAR(44) UNIQUE NOT NULL,
  numero VARCHAR(20) NOT NULL,
  serie VARCHAR(10),
  fornecedor_id UUID REFERENCES fabrica_fornecedores(id),
  data_emissao TIMESTAMP NOT NULL,
  valor_total DECIMAL(15,2) NOT NULL,
  xml_raw TEXT,
  pdf_url TEXT,
  status VARCHAR(20) DEFAULT 'imported' CHECK (status IN ('imported', 'validated', 'rejected', 'processing', 'confirmed')),
  motivo_rejeicao TEXT,
  usuario_conferente UUID,
  data_conferencia TIMESTAMP,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

-- Tabela de Itens da Nota Fiscal
CREATE TABLE IF NOT EXISTS fabrica_itens_nf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id UUID REFERENCES fabrica_notas_fiscais(id) ON DELETE CASCADE,
  numero_item INTEGER NOT NULL,
  codigo_fornecedor VARCHAR(100) NOT NULL,
  descricao TEXT NOT NULL,
  ncm VARCHAR(10),
  cfop VARCHAR(4),
  unidade VARCHAR(10) NOT NULL,
  quantidade DECIMAL(15,4) NOT NULL,
  valor_unitario DECIMAL(15,4) NOT NULL,
  valor_total DECIMAL(15,2) NOT NULL,
  produto_interno_id UUID REFERENCES fabrica_materias_primas(id),
  codigo_mapeado_id UUID REFERENCES fabrica_codigos_fornecedor(id),
  lote VARCHAR(50),
  validade DATE,
  quantidade_convertida DECIMAL(15,4),
  unidade_convertida VARCHAR(10),
  teor DECIMAL(5,2),
  status_mapeamento VARCHAR(20) DEFAULT 'pending' CHECK (status_mapeamento IN ('pending', 'mapped', 'manual_review', 'confirmed')),
  score_similaridade DECIMAL(3,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Atualizar tabela de movimentações existente
ALTER TABLE fabrica_movimentacoes ADD COLUMN IF NOT EXISTS nota_fiscal_id UUID REFERENCES fabrica_notas_fiscais(id);
ALTER TABLE fabrica_movimentacoes ADD COLUMN IF NOT EXISTS item_nf_id UUID REFERENCES fabrica_itens_nf(id);

-- Tabela de Logs de Processamento
CREATE TABLE IF NOT EXISTS fabrica_processamento_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id UUID REFERENCES fabrica_notas_fiscais(id),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('info', 'warning', 'error', 'success')),
  etapa VARCHAR(50) NOT NULL,
  mensagem TEXT NOT NULL,
  detalhes JSONB,
  usuario_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Configurações de Conversão
CREATE TABLE IF NOT EXISTS fabrica_conversoes_unidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_origem VARCHAR(10) NOT NULL,
  unidade_destino VARCHAR(10) NOT NULL,
  fator DECIMAL(15,6) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(unidade_origem, unidade_destino)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_notas_chave ON fabrica_notas_fiscais(chave_acesso);
CREATE INDEX IF NOT EXISTS idx_notas_status ON fabrica_notas_fiscais(status);
CREATE INDEX IF NOT EXISTS idx_notas_fornecedor ON fabrica_notas_fiscais(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_itens_nota ON fabrica_itens_nf(nota_id);
CREATE INDEX IF NOT EXISTS idx_itens_produto ON fabrica_itens_nf(produto_interno_id);
CREATE INDEX IF NOT EXISTS idx_codigos_fornecedor ON fabrica_codigos_fornecedor(fornecedor_id, codigo_fornecedor);

-- RLS: Limpar policies antigas e recriar
ALTER TABLE fabrica_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_codigos_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_itens_nf ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_processamento_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_conversoes_unidade ENABLE ROW LEVEL SECURITY;

-- RLS Policies para fabrica_codigos_fornecedor
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem ver códigos" ON fabrica_codigos_fornecedor;
CREATE POLICY "Usuários com permissão fabrica podem ver códigos"
  ON fabrica_codigos_fornecedor FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuários com permissão fabrica gerenciam códigos" ON fabrica_codigos_fornecedor;
CREATE POLICY "Usuários com permissão fabrica gerenciam códigos"
  ON fabrica_codigos_fornecedor FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

-- RLS Policies para fabrica_notas_fiscais
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem ver notas" ON fabrica_notas_fiscais;
CREATE POLICY "Usuários com permissão fabrica podem ver notas"
  ON fabrica_notas_fiscais FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuários com permissão fabrica gerenciam notas" ON fabrica_notas_fiscais;
CREATE POLICY "Usuários com permissão fabrica gerenciam notas"
  ON fabrica_notas_fiscais FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

-- RLS Policies para fabrica_itens_nf
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem ver itens" ON fabrica_itens_nf;
CREATE POLICY "Usuários com permissão fabrica podem ver itens"
  ON fabrica_itens_nf FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Usuários com permissão fabrica gerenciam itens" ON fabrica_itens_nf;
CREATE POLICY "Usuários com permissão fabrica gerenciam itens"
  ON fabrica_itens_nf FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

-- RLS Policies para fabrica_processamento_logs
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem ver logs" ON fabrica_processamento_logs;
CREATE POLICY "Usuários com permissão fabrica podem ver logs"
  ON fabrica_processamento_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sistema pode inserir logs" ON fabrica_processamento_logs;
CREATE POLICY "Sistema pode inserir logs"
  ON fabrica_processamento_logs FOR INSERT
  WITH CHECK (true);

-- RLS Policies para fabrica_conversoes_unidade
DROP POLICY IF EXISTS "Usuários com permissão fabrica podem ver conversões" ON fabrica_conversoes_unidade;
CREATE POLICY "Usuários com permissão fabrica podem ver conversões"
  ON fabrica_conversoes_unidade FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins gerenciam conversões" ON fabrica_conversoes_unidade;
CREATE POLICY "Admins gerenciam conversões"
  ON fabrica_conversoes_unidade FOR ALL
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

-- Inserir conversões comuns
INSERT INTO fabrica_conversoes_unidade (unidade_origem, unidade_destino, fator, descricao) VALUES
  ('G', 'KG', 0.001, 'Gramas para Quilogramas'),
  ('KG', 'G', 1000, 'Quilogramas para Gramas'),
  ('ML', 'L', 0.001, 'Mililitros para Litros'),
  ('L', 'ML', 1000, 'Litros para Mililitros'),
  ('UN', 'UN', 1, 'Unidade para Unidade'),
  ('PC', 'UN', 1, 'Peça para Unidade'),
  ('CX', 'UN', 12, 'Caixa para Unidades (padrão 12)'),
  ('PCT', 'UN', 10, 'Pacote para Unidades (padrão 10)')
ON CONFLICT (unidade_origem, unidade_destino) DO NOTHING;

-- Função para calcular similaridade de strings (Levenshtein simplificado)
CREATE OR REPLACE FUNCTION similarity_score(str1 TEXT, str2 TEXT)
RETURNS DECIMAL(3,2) AS $$
DECLARE
  s1 TEXT := LOWER(TRIM(str1));
  s2 TEXT := LOWER(TRIM(str2));
  len1 INT := LENGTH(s1);
  len2 INT := LENGTH(s2);
  max_len INT := GREATEST(len1, len2);
  common_chars INT := 0;
BEGIN
  IF max_len = 0 THEN
    RETURN 1.0;
  END IF;
  
  FOR i IN 1..LEAST(len1, len2) LOOP
    IF SUBSTRING(s1, i, 1) = SUBSTRING(s2, i, 1) THEN
      common_chars := common_chars + 1;
    END IF;
  END LOOP;
  
  RETURN ROUND((common_chars::DECIMAL / max_len::DECIMAL), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_fabrica_codigos_fornecedor_updated_at ON fabrica_codigos_fornecedor;
CREATE TRIGGER update_fabrica_codigos_fornecedor_updated_at
  BEFORE UPDATE ON fabrica_codigos_fornecedor
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();