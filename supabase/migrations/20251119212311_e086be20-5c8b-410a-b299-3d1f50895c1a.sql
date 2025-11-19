-- ============================================
-- CONFORMIDADE FISCAL COMPLETA - RECEBIMENTO MP
-- Baseado em teoria fiscal brasileira para indústria
-- ============================================

-- Adicionar campos de BASE DE CÁLCULO dos impostos
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS bc_icms NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS bc_ipi NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS bc_pis NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS bc_cofins NUMERIC(15,2);

-- Adicionar campos de VALORES DOS IMPOSTOS (para cálculo de crédito)
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS valor_icms NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_ipi NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_pis NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_cofins NUMERIC(15,2);

-- Adicionar campos de INDICADORES DE CRÉDITO
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS gera_credito_icms BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gera_credito_ipi BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gera_credito_pis BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gera_credito_cofins BOOLEAN DEFAULT false;

-- Adicionar campos de REGIME DE TRIBUTAÇÃO
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS regime_tributacao VARCHAR(50),
ADD COLUMN IF NOT EXISTS modalidade_bc_icms VARCHAR(10),
ADD COLUMN IF NOT EXISTS tipo_operacao VARCHAR(100);

-- Adicionar campos para DRAWBACK e regimes especiais
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS tem_drawback BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS numero_drawback VARCHAR(50),
ADD COLUMN IF NOT EXISTS industrializacao_encomenda BOOLEAN DEFAULT false;

-- Adicionar campos para DIFERIMENTO/SUSPENSÃO
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS icms_diferido BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS motivo_desoneracao_icms VARCHAR(10),
ADD COLUMN IF NOT EXISTS valor_icms_desonerado NUMERIC(15,2);

-- Adicionar campos para FCP (Fundo de Combate à Pobreza)
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS bc_fcp NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS aliquota_fcp NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS valor_fcp NUMERIC(15,2);

-- ============================================
-- TABELA DE HISTÓRICO DE CRÉDITOS TRIBUTÁRIOS
-- Para rastreabilidade de SPED/EFD e apuração
-- ============================================
CREATE TABLE IF NOT EXISTS fabrica_creditos_tributarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Relacionamentos
  produto_id UUID NOT NULL REFERENCES fabrica_materias_primas(id) ON DELETE CASCADE,
  nota_id UUID REFERENCES fabrica_notas_fiscais(id) ON DELETE SET NULL,
  movimentacao_id UUID REFERENCES fabrica_movimentacoes_estoque(id) ON DELETE SET NULL,
  
  -- Dados do crédito
  tipo_credito VARCHAR(20) NOT NULL CHECK (tipo_credito IN ('ICMS', 'IPI', 'PIS', 'COFINS')),
  valor_credito NUMERIC(15,2) NOT NULL,
  data_credito DATE NOT NULL,
  periodo_apuracao VARCHAR(7) NOT NULL, -- YYYY-MM
  
  -- Status do crédito
  status VARCHAR(20) NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'utilizado', 'expirado', 'estornado')),
  data_utilizacao DATE,
  valor_utilizado NUMERIC(15,2) DEFAULT 0,
  saldo_credito NUMERIC(15,2),
  
  -- Detalhes fiscais
  cfop VARCHAR(10),
  cst VARCHAR(10),
  base_calculo NUMERIC(15,2),
  aliquota NUMERIC(5,4),
  
  -- Rastreabilidade SPED
  escriturado_sped BOOLEAN DEFAULT false,
  periodo_escrituracao VARCHAR(7),
  
  -- Observações e justificativas
  observacoes TEXT,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_creditos_produto ON fabrica_creditos_tributarios(produto_id);
CREATE INDEX IF NOT EXISTS idx_creditos_nota ON fabrica_creditos_tributarios(nota_id);
CREATE INDEX IF NOT EXISTS idx_creditos_periodo ON fabrica_creditos_tributarios(periodo_apuracao);
CREATE INDEX IF NOT EXISTS idx_creditos_status ON fabrica_creditos_tributarios(status);
CREATE INDEX IF NOT EXISTS idx_creditos_tipo ON fabrica_creditos_tributarios(tipo_credito);

-- RLS Policies
ALTER TABLE fabrica_creditos_tributarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários com permissão fabrica podem ver créditos"
  ON fabrica_creditos_tributarios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuario_permissoes_modulos upm
      JOIN modulos_sistema ms ON ms.id = upm.modulo_id
      WHERE ms.codigo = 'fabrica' AND upm.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Admins e supervisores gerenciam créditos"
  ON fabrica_creditos_tributarios FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- ============================================
-- TABELA DE APURAÇÃO FISCAL MENSAL
-- Para consolidar créditos e débitos por período
-- ============================================
CREATE TABLE IF NOT EXISTS fabrica_apuracao_fiscal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Período de apuração
  periodo VARCHAR(7) NOT NULL, -- YYYY-MM
  tipo_imposto VARCHAR(20) NOT NULL CHECK (tipo_imposto IN ('ICMS', 'IPI', 'PIS', 'COFINS')),
  
  -- Saldos
  saldo_anterior NUMERIC(15,2) DEFAULT 0,
  total_creditos NUMERIC(15,2) DEFAULT 0,
  total_debitos NUMERIC(15,2) DEFAULT 0,
  saldo_periodo NUMERIC(15,2) DEFAULT 0,
  saldo_a_transportar NUMERIC(15,2) DEFAULT 0,
  
  -- Controle
  status VARCHAR(20) DEFAULT 'em_apuracao' CHECK (status IN ('em_apuracao', 'fechado', 'retificado')),
  data_fechamento DATE,
  responsavel_id UUID REFERENCES auth.users(id),
  
  -- SPED/Declarações
  escriturado_sped BOOLEAN DEFAULT false,
  data_escrituracao DATE,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(periodo, tipo_imposto)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_apuracao_periodo ON fabrica_apuracao_fiscal(periodo);
CREATE INDEX IF NOT EXISTS idx_apuracao_tipo ON fabrica_apuracao_fiscal(tipo_imposto);

-- RLS Policies
ALTER TABLE fabrica_apuracao_fiscal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins e supervisores gerenciam apuração"
  ON fabrica_apuracao_fiscal FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- ============================================
-- COMENTÁRIOS DESCRITIVOS
-- ============================================
COMMENT ON COLUMN fabrica_dados_fiscais_produto.bc_icms IS 'Base de cálculo do ICMS';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.valor_icms IS 'Valor do ICMS pago/a pagar na operação';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.gera_credito_icms IS 'Indica se a operação gera direito a crédito de ICMS';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.regime_tributacao IS 'Regime tributário aplicável (ex: normal, simples_nacional, monofasico)';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.modalidade_bc_icms IS 'Modalidade de determinação da BC do ICMS (0-MVA, 1-Pauta, 2-Preço tabelado, 3-Valor da operação)';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.tipo_operacao IS 'Tipo específico da operação (compra_industrializacao, remessa_industrializacao, retorno, etc)';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.tem_drawback IS 'Indica se a operação está em regime de drawback';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.industrializacao_encomenda IS 'Indica se é operação de industrialização por encomenda';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.icms_diferido IS 'Indica se o ICMS está diferido/suspenso';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.motivo_desoneracao_icms IS 'Motivo da desoneração do ICMS (quando aplicável)';

COMMENT ON TABLE fabrica_creditos_tributarios IS 'Histórico de créditos tributários (ICMS, IPI, PIS, COFINS) gerados no recebimento de matérias-primas para fins de apuração e SPED';
COMMENT ON TABLE fabrica_apuracao_fiscal IS 'Apuração mensal consolidada de impostos para conformidade fiscal e geração de obrigações acessórias';