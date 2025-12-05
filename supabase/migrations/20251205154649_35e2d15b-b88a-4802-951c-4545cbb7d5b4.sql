-- =============================================
-- INTEGRATION HUB - Infraestrutura Base
-- =============================================

-- Tabela de configurações de integrações
CREATE TABLE public.integration_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) NOT NULL DEFAULT 'inbound', -- inbound, outbound, bidirectional
  sistema_origem VARCHAR(100), -- N8N, TOTVS, SAP, Sankhya, API_CUSTOM
  
  -- Configurações de conexão
  endpoint_url TEXT,
  auth_type VARCHAR(50) DEFAULT 'api_key', -- api_key, bearer, basic, oauth2
  auth_config JSONB DEFAULT '{}', -- Credenciais criptografadas/referência
  
  -- Configurações de processamento
  entidade_destino VARCHAR(100) NOT NULL, -- contas_pagar, contas_receber, etc
  batch_size INTEGER DEFAULT 100,
  retry_attempts INTEGER DEFAULT 3,
  retry_delay_ms INTEGER DEFAULT 1000,
  timeout_ms INTEGER DEFAULT 30000,
  
  -- Rate limiting
  rate_limit_requests INTEGER DEFAULT 100,
  rate_limit_window_seconds INTEGER DEFAULT 60,
  
  -- Status
  ativo BOOLEAN DEFAULT true,
  ultima_execucao TIMESTAMPTZ,
  ultimo_status VARCHAR(50), -- success, error, partial
  ultimo_erro TEXT,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Tabela de mapeamento de campos dinâmico
CREATE TABLE public.integration_field_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES integration_configs(id) ON DELETE CASCADE,
  
  -- Campo de origem (sistema externo)
  campo_origem VARCHAR(255) NOT NULL,
  path_origem TEXT, -- JSON path para campos aninhados (ex: "dados.cliente.nome")
  
  -- Campo de destino (nosso banco)
  campo_destino VARCHAR(255) NOT NULL,
  
  -- Transformações
  tipo_transformacao VARCHAR(50) DEFAULT 'direct', -- direct, format_date, parse_number, lookup, custom
  formato_origem VARCHAR(100), -- Formato de data origem, etc
  formato_destino VARCHAR(100), -- Formato de data destino, etc
  funcao_transformacao TEXT, -- Função JS/SQL customizada
  valor_default TEXT, -- Valor padrão se origem for null
  
  -- Validações
  obrigatorio BOOLEAN DEFAULT false,
  validacao_regex VARCHAR(500),
  
  -- Metadados
  ativo BOOLEAN DEFAULT true,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de logs de integração
CREATE TABLE public.integration_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID REFERENCES integration_configs(id),
  
  -- Identificação
  codigo_integracao VARCHAR(50),
  direcao VARCHAR(20) NOT NULL, -- inbound, outbound
  
  -- Request/Response
  request_id VARCHAR(100), -- ID único da requisição
  endpoint VARCHAR(500),
  metodo VARCHAR(10),
  headers JSONB,
  payload_preview TEXT, -- Primeiros N caracteres do payload
  payload_size_bytes INTEGER,
  
  -- Resultado
  status VARCHAR(50) NOT NULL, -- pending, processing, success, error, partial
  status_code INTEGER,
  response_preview TEXT,
  
  -- Métricas
  registros_recebidos INTEGER DEFAULT 0,
  registros_processados INTEGER DEFAULT 0,
  registros_sucesso INTEGER DEFAULT 0,
  registros_erro INTEGER DEFAULT 0,
  duracao_ms INTEGER,
  
  -- Erros
  erro_tipo VARCHAR(100),
  erro_mensagem TEXT,
  erro_stack TEXT,
  
  -- Timestamps
  iniciado_em TIMESTAMPTZ DEFAULT now(),
  finalizado_em TIMESTAMPTZ,
  
  -- IP/User Agent para auditoria
  ip_address INET,
  user_agent TEXT
);

-- Tabela de fila de processamento (retry, outbound queue)
CREATE TABLE public.integration_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID REFERENCES integration_configs(id),
  
  -- Dados do item
  entidade VARCHAR(100) NOT NULL,
  entidade_id UUID,
  operacao VARCHAR(50) NOT NULL, -- create, update, delete, sync
  payload JSONB NOT NULL,
  
  -- Status de processamento
  status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  tentativas INTEGER DEFAULT 0,
  max_tentativas INTEGER DEFAULT 3,
  
  -- Agendamento
  agendado_para TIMESTAMPTZ DEFAULT now(),
  prioridade INTEGER DEFAULT 5, -- 1-10, menor = maior prioridade
  
  -- Resultado
  ultimo_erro TEXT,
  ultimo_erro_em TIMESTAMPTZ,
  processado_em TIMESTAMPTZ,
  
  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID
);

-- Índices para performance
CREATE INDEX idx_integration_configs_codigo ON integration_configs(codigo);
CREATE INDEX idx_integration_configs_ativo ON integration_configs(ativo);
CREATE INDEX idx_integration_configs_entidade ON integration_configs(entidade_destino);

CREATE INDEX idx_integration_field_mappings_config ON integration_field_mappings(config_id);
CREATE INDEX idx_integration_field_mappings_ativo ON integration_field_mappings(config_id, ativo);

CREATE INDEX idx_integration_logs_config ON integration_logs(config_id);
CREATE INDEX idx_integration_logs_status ON integration_logs(status);
CREATE INDEX idx_integration_logs_data ON integration_logs(iniciado_em DESC);
CREATE INDEX idx_integration_logs_codigo ON integration_logs(codigo_integracao);

CREATE INDEX idx_integration_queue_status ON integration_queue(status, agendado_para);
CREATE INDEX idx_integration_queue_config ON integration_queue(config_id);
CREATE INDEX idx_integration_queue_prioridade ON integration_queue(prioridade, agendado_para);

-- RLS Policies
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_field_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_queue ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar configurações
CREATE POLICY "Admins gerenciam integration_configs"
  ON integration_configs FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins e supervisores veem integration_configs"
  ON integration_configs FOR SELECT
  USING (is_admin_or_supervisor(auth.uid()));

-- Field mappings seguem config
CREATE POLICY "Admins gerenciam field_mappings"
  ON integration_field_mappings FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins e supervisores veem field_mappings"
  ON integration_field_mappings FOR SELECT
  USING (is_admin_or_supervisor(auth.uid()));

-- Logs podem ser vistos por admins/supervisores
CREATE POLICY "Admins e supervisores veem integration_logs"
  ON integration_logs FOR SELECT
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Sistema insere logs"
  ON integration_logs FOR INSERT
  WITH CHECK (true);

-- Queue gerenciada apenas por admins
CREATE POLICY "Admins gerenciam queue"
  ON integration_queue FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins e supervisores veem queue"
  ON integration_queue FOR SELECT
  USING (is_admin_or_supervisor(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_integration_configs_updated_at
  BEFORE UPDATE ON integration_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração inicial para N8N (contas a receber existente)
INSERT INTO integration_configs (
  codigo,
  nome,
  descricao,
  tipo,
  sistema_origem,
  entidade_destino,
  auth_type,
  batch_size,
  ativo
) VALUES (
  'n8n_contas_receber',
  'N8N - Contas a Receber',
  'Integração existente com N8N para sincronização de contas a receber',
  'inbound',
  'N8N',
  'contas_receber',
  'api_key',
  100,
  true
), (
  'n8n_contas_pagar',
  'N8N - Contas a Pagar',
  'Integração existente com N8N para sincronização de contas a pagar',
  'inbound',
  'N8N',
  'contas_pagar',
  'api_key',
  100,
  true
);