-- ============================================
-- FASE 1: CONTROLE DE CHÃO DE FÁBRICA
-- ============================================

-- 1.1 APONTAMENTO DE PRODUÇÃO
-- ============================================

-- Tabela de motivos de parada (cadastro)
CREATE TABLE IF NOT EXISTS fabrica_motivos_parada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  tipo VARCHAR(30) NOT NULL, -- setup, manutencao, falta_mp, falta_mao_obra, quebra, outros
  impacto_oee BOOLEAN DEFAULT true, -- se impacta no cálculo do OEE
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de apontamentos de produção (registro temporal)
CREATE TABLE IF NOT EXISTS fabrica_apontamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id UUID NOT NULL REFERENCES fabrica_ordens_producao(id) ON DELETE CASCADE,
  operador_id UUID REFERENCES profiles(id),
  tipo VARCHAR(20) NOT NULL, -- inicio, pausa, retomada, finalizacao
  quantidade_apontada DECIMAL(15,3) DEFAULT 0,
  quantidade_refugo DECIMAL(15,3) DEFAULT 0,
  quantidade_retrabalho DECIMAL(15,3) DEFAULT 0,
  timestamp_evento TIMESTAMPTZ NOT NULL DEFAULT now(),
  duracao_minutos INTEGER, -- calculado automaticamente
  observacoes TEXT,
  localizacao_gps JSONB, -- lat, lng para rastreamento mobile
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_apontamentos_op ON fabrica_apontamentos(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_operador ON fabrica_apontamentos(operador_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_timestamp ON fabrica_apontamentos(timestamp_evento);

-- Tabela de paradas não planejadas
CREATE TABLE IF NOT EXISTS fabrica_paradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id UUID NOT NULL REFERENCES fabrica_ordens_producao(id) ON DELETE CASCADE,
  motivo_parada_id UUID REFERENCES fabrica_motivos_parada(id),
  descricao_adicional TEXT,
  timestamp_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  timestamp_fim TIMESTAMPTZ,
  duracao_minutos INTEGER,
  operador_responsavel_id UUID REFERENCES profiles(id),
  impacto_financeiro DECIMAL(15,2), -- estimativa de custo da parada
  acao_corretiva TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paradas_op ON fabrica_paradas(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_paradas_motivo ON fabrica_paradas(motivo_parada_id);

-- 1.2 CONTROLE DE QUALIDADE
-- ============================================

-- Planos de inspeção por produto
CREATE TABLE IF NOT EXISTS fabrica_planos_inspecao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES fabrica_produtos(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  tipo_inspecao VARCHAR(30) NOT NULL, -- entrada, processo, final, periodica
  frequencia VARCHAR(30), -- cada_lote, diaria, semanal, amostragem
  tamanho_amostra INTEGER, -- quantas unidades inspecionar
  checklist JSONB NOT NULL, -- [{ item: "Cor", especificacao: "Verde", tipo: "visual|medida" }]
  criterios_aprovacao JSONB, -- { min_conformes: 95 }
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_inspecao_produto ON fabrica_planos_inspecao(produto_id);

-- Inspeções de qualidade realizadas
CREATE TABLE IF NOT EXISTS fabrica_inspecoes_qualidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES fabrica_lotes(id) ON DELETE CASCADE,
  plano_inspecao_id UUID REFERENCES fabrica_planos_inspecao(id),
  ordem_producao_id UUID REFERENCES fabrica_ordens_producao(id),
  inspetor_id UUID NOT NULL REFERENCES profiles(id),
  data_inspecao TIMESTAMPTZ NOT NULL DEFAULT now(),
  resultado VARCHAR(30) NOT NULL, -- aprovado, reprovado, condicional, quarentena
  resultados_checklist JSONB NOT NULL, -- [{ item: "Cor", conforme: true, valor_medido: "" }]
  quantidade_inspecionada DECIMAL(15,3),
  quantidade_aprovada DECIMAL(15,3),
  quantidade_reprovada DECIMAL(15,3),
  indice_conformidade DECIMAL(5,2), -- % de itens conformes
  observacoes TEXT,
  certificado_url TEXT, -- URL do COA (Certificate of Analysis)
  aprovado_por UUID REFERENCES profiles(id),
  data_aprovacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inspecoes_lote ON fabrica_inspecoes_qualidade(lote_id);
CREATE INDEX IF NOT EXISTS idx_inspecoes_inspetor ON fabrica_inspecoes_qualidade(inspetor_id);
CREATE INDEX IF NOT EXISTS idx_inspecoes_resultado ON fabrica_inspecoes_qualidade(resultado);

-- Não conformidades detectadas
CREATE TABLE IF NOT EXISTS fabrica_nao_conformidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspecao_id UUID REFERENCES fabrica_inspecoes_qualidade(id) ON DELETE CASCADE,
  ordem_producao_id UUID REFERENCES fabrica_ordens_producao(id),
  tipo VARCHAR(50) NOT NULL, -- dimensional, visual, funcional, contaminacao, embalagem
  gravidade VARCHAR(20) NOT NULL, -- critica, maior, menor
  descricao TEXT NOT NULL,
  causa_raiz TEXT,
  quantidade_afetada DECIMAL(15,3),
  custos_estimados DECIMAL(15,2),
  fotos JSONB, -- array de URLs
  detectado_por UUID REFERENCES profiles(id),
  detectado_em TIMESTAMPTZ DEFAULT now(),
  status VARCHAR(30) DEFAULT 'aberta', -- aberta, em_analise, resolvida, fechada
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nao_conformidades_status ON fabrica_nao_conformidades(status);
CREATE INDEX IF NOT EXISTS idx_nao_conformidades_gravidade ON fabrica_nao_conformidades(gravidade);

-- Ações corretivas
CREATE TABLE IF NOT EXISTS fabrica_acoes_corretivas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nao_conformidade_id UUID NOT NULL REFERENCES fabrica_nao_conformidades(id) ON DELETE CASCADE,
  tipo_acao VARCHAR(50) NOT NULL, -- retrabalho, refugo, contenção, preventiva
  descricao TEXT NOT NULL,
  responsavel_id UUID REFERENCES profiles(id),
  prazo_conclusao DATE,
  data_conclusao TIMESTAMPTZ,
  status VARCHAR(30) DEFAULT 'pendente', -- pendente, em_execucao, concluida, cancelada
  eficacia TEXT, -- avaliação da eficácia após implementação
  custos_acao DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_acoes_corretivas_responsavel ON fabrica_acoes_corretivas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_acoes_corretivas_status ON fabrica_acoes_corretivas(status);

-- 1.3 GESTÃO DE REFUGO E RETRABALHO
-- ============================================

-- Cadastro de causas de refugo
CREATE TABLE IF NOT EXISTS fabrica_causas_refugo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) NOT NULL UNIQUE,
  descricao TEXT NOT NULL,
  tipo VARCHAR(30) NOT NULL, -- materia_prima, processo, equipamento, mao_obra, embalagem
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Registro de refugo por OP
CREATE TABLE IF NOT EXISTS fabrica_refugos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id UUID NOT NULL REFERENCES fabrica_ordens_producao(id) ON DELETE CASCADE,
  lote_id UUID REFERENCES fabrica_lotes(id),
  causa_refugo_id UUID REFERENCES fabrica_causas_refugo(id),
  quantidade DECIMAL(15,3) NOT NULL,
  unidade VARCHAR(10),
  custo_estimado DECIMAL(15,2), -- custo do material refugado
  descricao TEXT,
  apontamento_id UUID REFERENCES fabrica_apontamentos(id), -- vincula ao apontamento
  operador_id UUID REFERENCES profiles(id),
  data_refugo TIMESTAMPTZ DEFAULT now(),
  disposicao VARCHAR(30), -- descarte, reprocesso, venda_residuo
  fotos JSONB, -- evidências
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_refugos_op ON fabrica_refugos(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_refugos_causa ON fabrica_refugos(causa_refugo_id);
CREATE INDEX IF NOT EXISTS idx_refugos_data ON fabrica_refugos(data_refugo);

-- Registro de retrabalho
CREATE TABLE IF NOT EXISTS fabrica_retrabalhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_original_id UUID REFERENCES fabrica_ordens_producao(id),
  ordem_producao_retrabalho_id UUID REFERENCES fabrica_ordens_producao(id), -- nova OP criada para retrabalho
  lote_origem_id UUID REFERENCES fabrica_lotes(id),
  nao_conformidade_id UUID REFERENCES fabrica_nao_conformidades(id),
  quantidade DECIMAL(15,3) NOT NULL,
  motivo TEXT NOT NULL,
  tipo_retrabalho VARCHAR(30), -- reprocesso, reembalagem, ajuste, separacao
  custo_adicional DECIMAL(15,2), -- MOD + material adicional
  tempo_adicional_minutos INTEGER,
  operador_responsavel_id UUID REFERENCES profiles(id),
  data_inicio TIMESTAMPTZ DEFAULT now(),
  data_conclusao TIMESTAMPTZ,
  resultado VARCHAR(30), -- aprovado, reprovado_novamente
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_retrabalhos_op_original ON fabrica_retrabalhos(ordem_producao_original_id);
CREATE INDEX IF NOT EXISTS idx_retrabalhos_resultado ON fabrica_retrabalhos(resultado);

-- ============================================
-- TRIGGERS E FUNÇÕES AUXILIARES
-- ============================================

-- Função para calcular duração de paradas
CREATE OR REPLACE FUNCTION calcular_duracao_parada()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.timestamp_fim IS NOT NULL THEN
    NEW.duracao_minutos := EXTRACT(EPOCH FROM (NEW.timestamp_fim - NEW.timestamp_inicio)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calcular_duracao_parada
BEFORE INSERT OR UPDATE ON fabrica_paradas
FOR EACH ROW
EXECUTE FUNCTION calcular_duracao_parada();

-- Função para atualizar status da OP baseado em apontamentos
CREATE OR REPLACE FUNCTION atualizar_status_op_apontamento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'inicio' THEN
    UPDATE fabrica_ordens_producao
    SET status = 'em_producao', data_inicio_real = NEW.timestamp_evento
    WHERE id = NEW.ordem_producao_id AND status = 'pendente';
  ELSIF NEW.tipo = 'finalizacao' THEN
    UPDATE fabrica_ordens_producao
    SET status = 'concluida', 
        data_conclusao_real = NEW.timestamp_evento,
        quantidade_produzida = (
          SELECT COALESCE(SUM(quantidade_apontada), 0)
          FROM fabrica_apontamentos
          WHERE ordem_producao_id = NEW.ordem_producao_id
        )
    WHERE id = NEW.ordem_producao_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_status_op
AFTER INSERT ON fabrica_apontamentos
FOR EACH ROW
EXECUTE FUNCTION atualizar_status_op_apontamento();

-- Função para colocar lote em quarentena se reprovado
CREATE OR REPLACE FUNCTION quarentena_lote_reprovado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.resultado IN ('reprovado', 'quarentena') AND NEW.lote_id IS NOT NULL THEN
    UPDATE fabrica_lotes
    SET status = 'quarentena'
    WHERE id = NEW.lote_id;
  ELSIF NEW.resultado = 'aprovado' AND NEW.lote_id IS NOT NULL THEN
    UPDATE fabrica_lotes
    SET status = 'ativo'
    WHERE id = NEW.lote_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_quarentena_lote
AFTER INSERT OR UPDATE ON fabrica_inspecoes_qualidade
FOR EACH ROW
EXECUTE FUNCTION quarentena_lote_reprovado();

-- ============================================
-- DADOS INICIAIS (SEED)
-- ============================================

-- Motivos de parada padrão
INSERT INTO fabrica_motivos_parada (codigo, descricao, tipo, impacto_oee) VALUES
('SETUP', 'Troca de produto / Setup de máquina', 'setup', true),
('MANUT_PREV', 'Manutenção preventiva programada', 'manutencao', true),
('MANUT_CORR', 'Manutenção corretiva (quebra)', 'quebra', true),
('FALTA_MP', 'Falta de matéria-prima', 'falta_mp', true),
('FALTA_MOD', 'Falta de mão de obra', 'falta_mao_obra', true),
('FALTA_EMBAL', 'Falta de embalagem', 'falta_mp', true),
('FALTA_ENERGIA', 'Falta de energia elétrica', 'outros', true),
('INSPECAO_QC', 'Inspeção de qualidade', 'outros', false),
('REFEICAO', 'Parada para refeição (programada)', 'outros', false),
('TREINAMENTO', 'Treinamento de equipe', 'outros', false),
('LIMPEZA', 'Limpeza e sanitização', 'setup', true),
('AJUSTE_PROCESSO', 'Ajuste de parâmetros de processo', 'setup', true)
ON CONFLICT (codigo) DO NOTHING;

-- Causas de refugo padrão
INSERT INTO fabrica_causas_refugo (codigo, descricao, tipo) VALUES
('MP_FORA_SPEC', 'Matéria-prima fora de especificação', 'materia_prima'),
('MP_CONTAMINADA', 'Matéria-prima contaminada', 'materia_prima'),
('FALHA_MISTURA', 'Falha no processo de mistura', 'processo'),
('TEMP_INADEQUADA', 'Temperatura inadequada no processo', 'processo'),
('TEMPO_PROCESSO', 'Tempo de processo incorreto', 'processo'),
('CONTAMINACAO_CRUZADA', 'Contaminação cruzada', 'processo'),
('EQUIPAMENTO_DESREG', 'Equipamento desregulado', 'equipamento'),
('FALHA_EQUIPAMENTO', 'Falha mecânica de equipamento', 'equipamento'),
('ERRO_OPERADOR', 'Erro de operação', 'mao_obra'),
('EMBALAGEM_DANIF', 'Embalagem danificada', 'embalagem'),
('ROTULO_ERRADO', 'Rótulo incorreto ou ilegível', 'embalagem'),
('QUEDA_PRODUTO', 'Queda ou dano físico ao produto', 'mao_obra')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Habilitar RLS
ALTER TABLE fabrica_motivos_parada ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_apontamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_paradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_planos_inspecao ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_inspecoes_qualidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_nao_conformidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_acoes_corretivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_causas_refugo ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_refugos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fabrica_retrabalhos ENABLE ROW LEVEL SECURITY;

-- Policies: usuários com módulo 'fabrica' podem acessar
CREATE POLICY "Usuários fabrica podem ver motivos parada"
  ON fabrica_motivos_parada FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem inserir motivos parada"
  ON fabrica_motivos_parada FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem atualizar motivos parada"
  ON fabrica_motivos_parada FOR UPDATE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- Apontamentos
CREATE POLICY "Usuários fabrica podem ver apontamentos"
  ON fabrica_apontamentos FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem inserir apontamentos"
  ON fabrica_apontamentos FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- Paradas
CREATE POLICY "Usuários fabrica podem ver paradas"
  ON fabrica_paradas FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem inserir paradas"
  ON fabrica_paradas FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem atualizar paradas"
  ON fabrica_paradas FOR UPDATE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- Planos de inspeção
CREATE POLICY "Usuários fabrica podem ver planos inspeção"
  ON fabrica_planos_inspecao FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem inserir planos inspeção"
  ON fabrica_planos_inspecao FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem atualizar planos inspeção"
  ON fabrica_planos_inspecao FOR UPDATE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- Inspeções de qualidade
CREATE POLICY "Usuários fabrica podem ver inspeções"
  ON fabrica_inspecoes_qualidade FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem inserir inspeções"
  ON fabrica_inspecoes_qualidade FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem atualizar inspeções"
  ON fabrica_inspecoes_qualidade FOR UPDATE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- Não conformidades
CREATE POLICY "Usuários fabrica podem ver não conformidades"
  ON fabrica_nao_conformidades FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem inserir não conformidades"
  ON fabrica_nao_conformidades FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem atualizar não conformidades"
  ON fabrica_nao_conformidades FOR UPDATE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- Ações corretivas
CREATE POLICY "Usuários fabrica podem ver ações corretivas"
  ON fabrica_acoes_corretivas FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem inserir ações corretivas"
  ON fabrica_acoes_corretivas FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem atualizar ações corretivas"
  ON fabrica_acoes_corretivas FOR UPDATE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- Causas de refugo
CREATE POLICY "Usuários fabrica podem ver causas refugo"
  ON fabrica_causas_refugo FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem inserir causas refugo"
  ON fabrica_causas_refugo FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- Refugos
CREATE POLICY "Usuários fabrica podem ver refugos"
  ON fabrica_refugos FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem inserir refugos"
  ON fabrica_refugos FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

-- Retrabalhos
CREATE POLICY "Usuários fabrica podem ver retrabalhos"
  ON fabrica_retrabalhos FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem inserir retrabalhos"
  ON fabrica_retrabalhos FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));

CREATE POLICY "Usuários fabrica podem atualizar retrabalhos"
  ON fabrica_retrabalhos FOR UPDATE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'fabrica'));