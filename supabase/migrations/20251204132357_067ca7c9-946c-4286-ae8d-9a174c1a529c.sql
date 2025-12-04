-- =============================================
-- SISTEMA COMPLETO DE CONTAS A RECEBER
-- =============================================

-- Tabela principal de contas a receber
CREATE TABLE IF NOT EXISTS public.contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_id TEXT UNIQUE NOT NULL,
  data_hash TEXT,
  
  -- Dados da empresa/cliente
  empresa_id INTEGER NOT NULL,
  empresa_nome TEXT,
  cliente_codigo TEXT,
  cliente_nome TEXT,
  
  -- Dados do documento
  tipo_documento TEXT,
  numero_documento TEXT,
  parcela INTEGER DEFAULT 1,
  tabela_preco TEXT,
  
  -- Datas
  data_emissao DATE,
  data_vencimento DATE,
  data_recebimento DATE,
  
  -- Valores financeiros
  valor_original DECIMAL(15,2) DEFAULT 0,
  valor_aberto DECIMAL(15,2) DEFAULT 0,
  valor_recebido DECIMAL(15,2) DEFAULT 0,
  valor_juros DECIMAL(15,2) DEFAULT 0,
  valor_desconto DECIMAL(15,2) DEFAULT 0,
  valor_ajustes DECIMAL(15,2) DEFAULT 0,
  
  -- Informações adicionais
  vendedor_codigo TEXT,
  vendedor_nome TEXT,
  portador_id TEXT,
  portador TEXT,
  conta TEXT,
  
  -- Status calculado
  status TEXT DEFAULT 'pendente',
  dias_atraso INTEGER DEFAULT 0,
  
  -- Metadados
  sincronizado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de cobranças/ações
CREATE TABLE IF NOT EXISTS public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id UUID REFERENCES contas_receber(id) ON DELETE CASCADE,
  cliente_codigo TEXT,
  
  -- Ação de cobrança
  tipo_acao TEXT NOT NULL,
  data_acao TIMESTAMPTZ DEFAULT now(),
  responsavel_id UUID,
  responsavel_nome TEXT,
  
  -- Resultado
  status TEXT DEFAULT 'pendente',
  observacoes TEXT,
  data_retorno DATE,
  
  -- Acordo (se houver)
  valor_acordo DECIMAL(15,2),
  data_acordo DATE,
  parcelas_acordo INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de histórico de cobranças
CREATE TABLE IF NOT EXISTS public.historico_cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id UUID REFERENCES contas_receber(id) ON DELETE CASCADE,
  cliente_codigo TEXT,
  tipo_evento TEXT NOT NULL,
  descricao TEXT,
  usuario_id UUID,
  usuario_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa ON contas_receber(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente ON contas_receber(cliente_codigo);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status ON contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_vencimento ON contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cobrancas_conta ON cobrancas(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente ON cobrancas(cliente_codigo);
CREATE INDEX IF NOT EXISTS idx_historico_conta ON historico_cobrancas(conta_receber_id);

-- Função para calcular status automaticamente
CREATE OR REPLACE FUNCTION calcular_status_conta_receber()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular dias de atraso
  IF NEW.data_vencimento IS NOT NULL THEN
    NEW.dias_atraso := GREATEST(0, CURRENT_DATE - NEW.data_vencimento);
  ELSE
    NEW.dias_atraso := 0;
  END IF;
  
  -- Determinar status
  IF NEW.valor_aberto = 0 OR NEW.valor_aberto IS NULL THEN
    NEW.status := 'recebido';
  ELSIF NEW.valor_recebido > 0 AND NEW.valor_aberto > 0 THEN
    NEW.status := 'parcial';
  ELSIF NEW.data_vencimento < CURRENT_DATE AND NEW.valor_aberto > 0 THEN
    NEW.status := 'vencido';
  ELSE
    NEW.status := 'pendente';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para calcular status
DROP TRIGGER IF EXISTS trigger_calcular_status_conta ON contas_receber;
CREATE TRIGGER trigger_calcular_status_conta
  BEFORE INSERT OR UPDATE ON contas_receber
  FOR EACH ROW
  EXECUTE FUNCTION calcular_status_conta_receber();

-- RLS Policies
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_cobrancas ENABLE ROW LEVEL SECURITY;

-- Políticas para contas_receber
CREATE POLICY "contas_receber_select" ON contas_receber
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND departamento_id IN (
      SELECT id FROM departamentos WHERE nome ILIKE '%financeiro%' OR nome ILIKE '%cobranca%'
    ))
  );

CREATE POLICY "contas_receber_all" ON contas_receber
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Políticas para cobrancas
CREATE POLICY "cobrancas_select" ON cobrancas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND departamento_id IN (
      SELECT id FROM departamentos WHERE nome ILIKE '%financeiro%' OR nome ILIKE '%cobranca%'
    ))
  );

CREATE POLICY "cobrancas_insert" ON cobrancas
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND departamento_id IN (
      SELECT id FROM departamentos WHERE nome ILIKE '%financeiro%' OR nome ILIKE '%cobranca%'
    ))
  );

CREATE POLICY "cobrancas_update" ON cobrancas
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
    OR responsavel_id = auth.uid()
  );

-- Políticas para historico_cobrancas
CREATE POLICY "historico_cobrancas_select" ON historico_cobrancas
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND departamento_id IN (
      SELECT id FROM departamentos WHERE nome ILIKE '%financeiro%' OR nome ILIKE '%cobranca%'
    ))
  );

CREATE POLICY "historico_cobrancas_insert" ON historico_cobrancas
  FOR INSERT WITH CHECK (true);