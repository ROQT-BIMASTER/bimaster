-- ============================================
-- MÓDULO FÁBRICA - ESTRUTURA COMPLETA
-- ============================================

-- Criar módulo no sistema
INSERT INTO modulos_sistema (codigo, nome, descricao, icone, ordem, ativo)
VALUES ('fabrica', 'Fábrica', 'Gestão de Custos e Produção', 'Factory', 4, true)
ON CONFLICT (codigo) DO NOTHING;

-- Criar telas do módulo
INSERT INTO telas_sistema (codigo, modulo_codigo, nome, descricao, rota, icone, ordem, ativo)
VALUES
('fabrica_dashboard', 'fabrica', 'Dashboard Fábrica', 'Visão geral da produção', '/dashboard/fabrica', 'LayoutDashboard', 1, true),
('fabrica_mps', 'fabrica', 'Matérias-Primas', 'Gestão de matérias-primas e insumos', '/dashboard/fabrica/materias-primas', 'Package', 2, true),
('fabrica_produtos', 'fabrica', 'Produtos', 'Catálogo de produtos fabricados', '/dashboard/fabrica/produtos', 'Box', 3, true),
('fabrica_producao', 'fabrica', 'Ordens de Produção', 'Controle de ordens de produção', '/dashboard/fabrica/producao', 'ClipboardList', 4, true),
('fabrica_custos', 'fabrica', 'Custos', 'Gestão de custos de produção', '/dashboard/fabrica/custos', 'DollarSign', 5, true),
('fabrica_estoque', 'fabrica', 'Estoque', 'Controle de estoque', '/dashboard/fabrica/estoque', 'Database', 6, true),
('fabrica_relatorios', 'fabrica', 'Relatórios', 'Relatórios gerenciais', '/dashboard/fabrica/relatorios', 'FileText', 7, true)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- TABELAS DE CADASTROS BÁSICOS
-- ============================================

-- Categorias de Matérias-Primas
CREATE TABLE IF NOT EXISTS fabrica_categorias_mp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL UNIQUE,
  descricao TEXT,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Fornecedores
CREATE TABLE IF NOT EXISTS fabrica_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social VARCHAR(200) NOT NULL,
  nome_fantasia VARCHAR(200),
  cnpj VARCHAR(18) UNIQUE,
  contato VARCHAR(100),
  telefone VARCHAR(20),
  email VARCHAR(100),
  endereco TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Unidades de Medida
CREATE TABLE IF NOT EXISTS fabrica_unidades_medida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla VARCHAR(10) NOT NULL UNIQUE,
  nome VARCHAR(50) NOT NULL,
  tipo VARCHAR(20) NOT NULL, -- 'massa', 'volume', 'unidade', 'comprimento'
  created_at TIMESTAMP DEFAULT now()
);

-- Inserir unidades comuns
INSERT INTO fabrica_unidades_medida (sigla, nome, tipo) VALUES
('KG', 'Quilograma', 'massa'),
('G', 'Grama', 'massa'),
('L', 'Litro', 'volume'),
('ML', 'Mililitro', 'volume'),
('UN', 'Unidade', 'unidade'),
('M', 'Metro', 'comprimento'),
('CM', 'Centímetro', 'comprimento')
ON CONFLICT (sigla) DO NOTHING;

-- ============================================
-- MATÉRIAS-PRIMAS
-- ============================================

CREATE TABLE IF NOT EXISTS fabrica_materias_primas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(200) NOT NULL,
  categoria_id UUID REFERENCES fabrica_categorias_mp(id),
  fornecedor_id UUID REFERENCES fabrica_fornecedores(id),
  unidade_medida_id UUID REFERENCES fabrica_unidades_medida(id),
  estoque_atual DECIMAL(10,3) DEFAULT 0,
  estoque_minimo DECIMAL(10,3) DEFAULT 0,
  custo_unitario DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'disponivel', -- 'disponivel', 'quarentena', 'bloqueado'
  data_validade DATE,
  lote VARCHAR(50),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fabrica_mps_categoria ON fabrica_materias_primas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_fabrica_mps_fornecedor ON fabrica_materias_primas(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fabrica_mps_status ON fabrica_materias_primas(status);
CREATE INDEX IF NOT EXISTS idx_fabrica_mps_estoque ON fabrica_materias_primas(estoque_atual);

-- ============================================
-- PRODUTOS FABRICADOS
-- ============================================

CREATE TABLE IF NOT EXISTS fabrica_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  unidade_medida_id UUID REFERENCES fabrica_unidades_medida(id),
  tempo_producao_minutos INTEGER,
  rendimento DECIMAL(10,3),
  ativo BOOLEAN DEFAULT true,
  foto_url TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Fórmulas/Receitas dos Produtos
CREATE TABLE IF NOT EXISTS fabrica_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES fabrica_produtos(id) ON DELETE CASCADE,
  versao INTEGER DEFAULT 1,
  ativa BOOLEAN DEFAULT true,
  descricao TEXT,
  rendimento DECIMAL(10,3),
  created_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(produto_id, versao)
);

-- Itens da Fórmula
CREATE TABLE IF NOT EXISTS fabrica_formula_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID REFERENCES fabrica_formulas(id) ON DELETE CASCADE,
  mp_id UUID REFERENCES fabrica_materias_primas(id),
  quantidade DECIMAL(10,3) NOT NULL,
  percentual DECIMAL(5,2),
  ordem INTEGER,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT now()
);

-- ============================================
-- ORDENS DE PRODUÇÃO
-- ============================================

CREATE TABLE IF NOT EXISTS fabrica_ordens_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(50) NOT NULL UNIQUE,
  produto_id UUID REFERENCES fabrica_produtos(id),
  formula_id UUID REFERENCES fabrica_formulas(id),
  quantidade_planejada DECIMAL(10,3) NOT NULL,
  quantidade_produzida DECIMAL(10,3) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'em_producao', 'concluida', 'cancelada'
  data_inicio TIMESTAMP,
  data_fim TIMESTAMP,
  data_prevista DATE,
  lote VARCHAR(50),
  responsavel_id UUID REFERENCES auth.users(id),
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fabrica_op_produto ON fabrica_ordens_producao(produto_id);
CREATE INDEX IF NOT EXISTS idx_fabrica_op_status ON fabrica_ordens_producao(status);
CREATE INDEX IF NOT EXISTS idx_fabrica_op_responsavel ON fabrica_ordens_producao(responsavel_id);

-- ============================================
-- MOVIMENTAÇÕES DE ESTOQUE
-- ============================================

CREATE TABLE IF NOT EXISTS fabrica_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mp_id UUID REFERENCES fabrica_materias_primas(id),
  tipo VARCHAR(20) NOT NULL, -- 'entrada', 'saida', 'ajuste', 'producao'
  quantidade DECIMAL(10,3) NOT NULL,
  estoque_anterior DECIMAL(10,3),
  estoque_novo DECIMAL(10,3),
  custo_unitario DECIMAL(10,2),
  valor_total DECIMAL(10,2),
  ordem_producao_id UUID REFERENCES fabrica_ordens_producao(id),
  lote VARCHAR(50),
  data_validade DATE,
  documento VARCHAR(100),
  motivo TEXT,
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fabrica_mov_mp ON fabrica_movimentacoes(mp_id);
CREATE INDEX IF NOT EXISTS idx_fabrica_mov_tipo ON fabrica_movimentacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_fabrica_mov_op ON fabrica_movimentacoes(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_fabrica_mov_data ON fabrica_movimentacoes(created_at);

-- ============================================
-- CUSTOS DE PRODUÇÃO
-- ============================================

CREATE TABLE IF NOT EXISTS fabrica_custos_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id UUID REFERENCES fabrica_ordens_producao(id) ON DELETE CASCADE,
  tipo_custo VARCHAR(50) NOT NULL, -- 'materia_prima', 'mao_obra', 'energia', 'outros'
  descricao TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  quantidade DECIMAL(10,3),
  custo_unitario DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_fabrica_custos_op ON fabrica_custos_producao(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_fabrica_custos_tipo ON fabrica_custos_producao(tipo_custo);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE fabrica_categorias_mp ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_unidades_medida ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_materias_primas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_formula_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_ordens_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_custos_producao ENABLE ROW LEVEL SECURITY;

-- Policies para fabrica_categorias_mp
CREATE POLICY "Usuários com permissão fabrica podem ver categorias"
  ON fabrica_categorias_mp FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admins e supervisores gerenciam categorias"
  ON fabrica_categorias_mp FOR ALL
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

-- Policies para fabrica_fornecedores
CREATE POLICY "Usuários com permissão fabrica podem ver fornecedores"
  ON fabrica_fornecedores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admins e supervisores gerenciam fornecedores"
  ON fabrica_fornecedores FOR ALL
  USING (is_admin_or_supervisor(auth.uid()))
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

-- Policies para fabrica_unidades_medida
CREATE POLICY "Todos podem ver unidades de medida"
  ON fabrica_unidades_medida FOR SELECT
  USING (true);

-- Policies para fabrica_materias_primas
CREATE POLICY "Usuários com permissão fabrica podem ver MPs"
  ON fabrica_materias_primas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários com permissão fabrica podem criar MPs"
  ON fabrica_materias_primas FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Criadores e admins podem atualizar MPs"
  ON fabrica_materias_primas FOR UPDATE
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Apenas admins podem deletar MPs"
  ON fabrica_materias_primas FOR DELETE
  USING (is_admin_or_supervisor(auth.uid()));

-- Policies para fabrica_produtos
CREATE POLICY "Usuários com permissão fabrica podem ver produtos"
  ON fabrica_produtos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários com permissão fabrica podem criar produtos"
  ON fabrica_produtos FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Criadores e admins podem atualizar produtos"
  ON fabrica_produtos FOR UPDATE
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Apenas admins podem deletar produtos"
  ON fabrica_produtos FOR DELETE
  USING (is_admin_or_supervisor(auth.uid()));

-- Policies para fabrica_formulas
CREATE POLICY "Usuários com permissão fabrica podem ver fórmulas"
  ON fabrica_formulas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários com permissão fabrica gerenciam fórmulas"
  ON fabrica_formulas FOR ALL
  USING (
    created_by = auth.uid() OR is_admin_or_supervisor(auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid() OR is_admin_or_supervisor(auth.uid())
  );

-- Policies para fabrica_formula_itens
CREATE POLICY "Usuários com permissão fabrica podem ver itens de fórmula"
  ON fabrica_formula_itens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários com permissão fabrica gerenciam itens de fórmula"
  ON fabrica_formula_itens FOR ALL
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

-- Policies para fabrica_ordens_producao
CREATE POLICY "Usuários com permissão fabrica podem ver OPs"
  ON fabrica_ordens_producao FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários com permissão fabrica gerenciam OPs"
  ON fabrica_ordens_producao FOR ALL
  USING (
    created_by = auth.uid() OR responsavel_id = auth.uid() OR is_admin_or_supervisor(auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid() OR responsavel_id = auth.uid() OR is_admin_or_supervisor(auth.uid())
  );

-- Policies para fabrica_movimentacoes
CREATE POLICY "Usuários com permissão fabrica podem ver movimentações"
  ON fabrica_movimentacoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários com permissão fabrica gerenciam movimentações"
  ON fabrica_movimentacoes FOR ALL
  USING (
    created_by = auth.uid() OR is_admin_or_supervisor(auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid() OR is_admin_or_supervisor(auth.uid())
  );

-- Policies para fabrica_custos_producao
CREATE POLICY "Usuários com permissão fabrica podem ver custos"
  ON fabrica_custos_producao FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários com permissão fabrica gerenciam custos"
  ON fabrica_custos_producao FOR ALL
  USING (
    created_by = auth.uid() OR is_admin_or_supervisor(auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid() OR is_admin_or_supervisor(auth.uid())
  );

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fabrica_categorias_mp_updated_at BEFORE UPDATE ON fabrica_categorias_mp
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fabrica_fornecedores_updated_at BEFORE UPDATE ON fabrica_fornecedores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fabrica_materias_primas_updated_at BEFORE UPDATE ON fabrica_materias_primas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fabrica_produtos_updated_at BEFORE UPDATE ON fabrica_produtos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fabrica_ordens_producao_updated_at BEFORE UPDATE ON fabrica_ordens_producao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();