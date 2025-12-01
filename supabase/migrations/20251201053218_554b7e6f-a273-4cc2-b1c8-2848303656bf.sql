-- Criar tabela contas_pagar
CREATE TABLE contas_pagar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Identificação única para upsert (composite key do ERP)
  erp_id VARCHAR(100) UNIQUE NOT NULL,
  
  -- Dados da Empresa
  empresa_id INTEGER NOT NULL,
  empresa_nome VARCHAR(100),
  
  -- Documento
  tipo_documento VARCHAR(20),
  numero_documento VARCHAR(50),
  parcela INTEGER DEFAULT 1,
  
  -- Fornecedor (campo "Cliente" no ERP é o fornecedor)
  fornecedor_codigo VARCHAR(50),
  fornecedor_nome VARCHAR(255),
  
  -- Valores
  valor_original NUMERIC(15,2) DEFAULT 0,
  valor_aberto NUMERIC(15,2) DEFAULT 0,
  valor_pago NUMERIC(15,2) DEFAULT 0,
  valor_juros NUMERIC(15,2) DEFAULT 0,
  valor_desconto NUMERIC(15,2) DEFAULT 0,
  valor_ajustes NUMERIC(15,2) DEFAULT 0,
  
  -- Datas
  data_emissao DATE,
  data_vencimento DATE,
  data_pagamento DATE,
  
  -- Categoria/Histórico
  categoria_codigo VARCHAR(20),
  categoria_nome VARCHAR(100),
  
  -- Outros
  portador VARCHAR(100),
  conta VARCHAR(100),
  
  -- Hash para controle de alterações (evita updates desnecessários)
  data_hash VARCHAR(32),
  
  -- Status (calculado por trigger)
  status VARCHAR(20),
  
  -- Auditoria
  sincronizado_em TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela sync_control
CREATE TABLE sync_control (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entidade VARCHAR(50) NOT NULL,
  empresa_id INTEGER,
  ultima_sync TIMESTAMPTZ,
  total_registros INTEGER DEFAULT 0,
  registros_inseridos INTEGER DEFAULT 0,
  registros_atualizados INTEGER DEFAULT 0,
  registros_ignorados INTEGER DEFAULT 0,
  duracao_ms INTEGER,
  status VARCHAR(20) DEFAULT 'success',
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX idx_contas_pagar_empresa ON contas_pagar(empresa_id);
CREATE INDEX idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX idx_contas_pagar_vencimento ON contas_pagar(data_vencimento);
CREATE INDEX idx_contas_pagar_fornecedor ON contas_pagar(fornecedor_nome);
CREATE INDEX idx_contas_pagar_categoria ON contas_pagar(categoria_nome);
CREATE INDEX idx_contas_pagar_data_hash ON contas_pagar(data_hash);
CREATE INDEX idx_sync_control_entidade ON sync_control(entidade, empresa_id);

-- Função para calcular status
CREATE OR REPLACE FUNCTION calcular_status_conta_pagar()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := CASE 
    WHEN NEW.valor_aberto = 0 OR NEW.valor_aberto IS NULL THEN 'pago'
    WHEN NEW.valor_pago > 0 AND NEW.valor_aberto > 0 THEN 'parcial'
    WHEN NEW.data_vencimento < CURRENT_DATE AND NEW.valor_aberto > 0 THEN 'vencido'
    ELSE 'pendente'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Configurar RLS Policies
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_control ENABLE ROW LEVEL SECURITY;

-- Usuários aprovados podem visualizar contas a pagar
CREATE POLICY "Usuários aprovados podem ver contas a pagar"
ON contas_pagar FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.aprovado = true
));

-- Sync control apenas para admins
CREATE POLICY "Admins podem ver sync control"
ON sync_control FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Sistema pode inserir sync control"
ON sync_control FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Sistema pode inserir/atualizar contas (via edge function)
CREATE POLICY "Sistema pode gerenciar contas a pagar"
ON contas_pagar FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Criar triggers
CREATE TRIGGER calcular_status_conta_pagar_trigger
  BEFORE INSERT OR UPDATE ON contas_pagar
  FOR EACH ROW EXECUTE FUNCTION calcular_status_conta_pagar();

CREATE TRIGGER update_contas_pagar_updated_at
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();