-- Tabela de templates de mensagem para cobranças
CREATE TABLE public.templates_cobranca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  canal TEXT NOT NULL CHECK (canal IN ('email', 'whatsapp', 'sms')),
  assunto TEXT,
  conteudo TEXT NOT NULL,
  variaveis JSONB DEFAULT '["cliente_nome", "valor", "vencimento", "dias_atraso", "documento"]',
  ativo BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de fila de cobranças para processamento
CREATE TABLE public.fila_cobrancas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_codigo TEXT NOT NULL,
  cliente_nome TEXT,
  cliente_email TEXT,
  cliente_telefone TEXT,
  conta_receber_id UUID REFERENCES public.contas_receber(id),
  canal TEXT NOT NULL CHECK (canal IN ('email', 'whatsapp', 'sms')),
  template_id UUID REFERENCES public.templates_cobranca(id),
  template_nome TEXT,
  mensagem_personalizada TEXT,
  prioridade INTEGER DEFAULT 5 CHECK (prioridade BETWEEN 1 AND 10),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'enviado', 'erro', 'cancelado')),
  agendado_para TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tentativas INTEGER DEFAULT 0,
  max_tentativas INTEGER DEFAULT 3,
  erro_mensagem TEXT,
  dados_adicionais JSONB DEFAULT '{}',
  criado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de histórico de cobranças enviadas
CREATE TABLE public.cobrancas_enviadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fila_id UUID REFERENCES public.fila_cobrancas(id),
  cliente_codigo TEXT NOT NULL,
  cliente_nome TEXT,
  conta_receber_id UUID,
  canal TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  assunto TEXT,
  mensagem TEXT NOT NULL,
  status_envio TEXT NOT NULL DEFAULT 'enviado' CHECK (status_envio IN ('enviado', 'entregue', 'lido', 'erro', 'bounce')),
  status_resposta TEXT CHECK (status_resposta IN ('sem_resposta', 'respondeu', 'pagou', 'prometeu_pagar', 'contestou')),
  provider_id TEXT,
  provider_response JSONB,
  enviado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  entregue_em TIMESTAMP WITH TIME ZONE,
  lido_em TIMESTAMP WITH TIME ZONE,
  respondido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de regras de cobrança automática
CREATE TABLE public.regras_cobranca (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  prioridade INTEGER DEFAULT 5,
  dias_atraso_min INTEGER NOT NULL,
  dias_atraso_max INTEGER,
  valor_min NUMERIC,
  valor_max NUMERIC,
  score_min INTEGER,
  score_max INTEGER,
  canal TEXT NOT NULL CHECK (canal IN ('email', 'whatsapp', 'sms', 'todos')),
  template_id UUID REFERENCES public.templates_cobranca(id),
  intervalo_dias INTEGER DEFAULT 3,
  max_tentativas INTEGER DEFAULT 3,
  horario_inicio TIME DEFAULT '09:00',
  horario_fim TIME DEFAULT '18:00',
  dias_semana INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_fila_cobrancas_status ON public.fila_cobrancas(status);
CREATE INDEX idx_fila_cobrancas_agendado ON public.fila_cobrancas(agendado_para) WHERE status = 'pendente';
CREATE INDEX idx_fila_cobrancas_cliente ON public.fila_cobrancas(cliente_codigo);
CREATE INDEX idx_cobrancas_enviadas_cliente ON public.cobrancas_enviadas(cliente_codigo);
CREATE INDEX idx_cobrancas_enviadas_data ON public.cobrancas_enviadas(enviado_em);
CREATE INDEX idx_regras_cobranca_ativo ON public.regras_cobranca(ativo, prioridade);
CREATE INDEX idx_templates_cobranca_canal ON public.templates_cobranca(canal) WHERE ativo = true;

-- Enable RLS
ALTER TABLE public.templates_cobranca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fila_cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas_enviadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_cobranca ENABLE ROW LEVEL SECURITY;

-- RLS Policies para templates_cobranca
CREATE POLICY "Admins e supervisores veem templates"
  ON public.templates_cobranca FOR SELECT
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins gerenciam templates"
  ON public.templates_cobranca FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies para fila_cobrancas
CREATE POLICY "Admins e supervisores veem fila de cobranças"
  ON public.fila_cobrancas FOR SELECT
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores inserem na fila"
  ON public.fila_cobrancas FOR INSERT
  WITH CHECK (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores atualizam fila"
  ON public.fila_cobrancas FOR UPDATE
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins podem deletar da fila"
  ON public.fila_cobrancas FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies para cobrancas_enviadas
CREATE POLICY "Admins e supervisores veem histórico de envios"
  ON public.cobrancas_enviadas FOR SELECT
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Sistema pode inserir histórico"
  ON public.cobrancas_enviadas FOR INSERT
  WITH CHECK (true);

-- RLS Policies para regras_cobranca
CREATE POLICY "Admins e supervisores veem regras"
  ON public.regras_cobranca FOR SELECT
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins gerenciam regras"
  ON public.regras_cobranca FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Triggers para updated_at
CREATE TRIGGER update_templates_cobranca_updated_at
  BEFORE UPDATE ON public.templates_cobranca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fila_cobrancas_updated_at
  BEFORE UPDATE ON public.fila_cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_regras_cobranca_updated_at
  BEFORE UPDATE ON public.regras_cobranca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir templates padrão
INSERT INTO public.templates_cobranca (nome, canal, assunto, conteudo, descricao) VALUES
('Lembrete Amigável - Email', 'email', 'Lembrete: Fatura {{documento}} vencida', 
'Olá {{cliente_nome}},

Esperamos que esteja bem! Notamos que a fatura {{documento}} no valor de R$ {{valor}}, com vencimento em {{vencimento}}, encontra-se em aberto há {{dias_atraso}} dias.

Caso já tenha efetuado o pagamento, por favor desconsidere este aviso.

Para sua comodidade, segue o link para pagamento: {{link_pagamento}}

Qualquer dúvida, estamos à disposição.

Atenciosamente,
Equipe Financeira', 'Template para primeiro contato amigável'),

('Cobrança Formal - Email', 'email', 'URGENTE: Regularize sua pendência - Fatura {{documento}}',
'Prezado(a) {{cliente_nome}},

Informamos que a fatura {{documento}} no valor de R$ {{valor}}, vencida em {{vencimento}}, permanece em aberto há {{dias_atraso}} dias, apesar de nossos contatos anteriores.

Solicitamos a regularização imediata para evitar:
- Inclusão nos órgãos de proteção ao crédito
- Suspensão de novos pedidos
- Protesto do título

Para negociar condições especiais de pagamento, entre em contato conosco.

Atenciosamente,
Departamento de Cobrança', 'Template para cobrança mais formal após tentativas anteriores'),

('WhatsApp Amigável', 'whatsapp', NULL,
'Olá {{cliente_nome}}! 👋

Tudo bem? Passando para lembrar sobre a fatura *{{documento}}* no valor de *R$ {{valor}}*, vencida em {{vencimento}}.

Se precisar de condições especiais, é só falar! 😊

_Financeiro_', 'Template amigável para WhatsApp'),

('WhatsApp Formal', 'whatsapp', NULL,
'{{cliente_nome}}, boa tarde.

Identificamos pendência da fatura *{{documento}}* - R$ *{{valor}}*, vencida há *{{dias_atraso}} dias*.

⚠️ Regularize para evitar restrições cadastrais.

Entre em contato para negociar.

_Depto. Cobrança_', 'Template formal para WhatsApp');

-- Inserir regras padrão de escalonamento
INSERT INTO public.regras_cobranca (nome, descricao, dias_atraso_min, dias_atraso_max, canal, intervalo_dias, max_tentativas, prioridade) VALUES
('Lembrete 1-7 dias', 'Primeiro lembrete amigável', 1, 7, 'email', 3, 2, 1),
('Cobrança 8-15 dias', 'Cobrança mais assertiva', 8, 15, 'todos', 2, 3, 2),
('Cobrança 16-30 dias', 'Cobrança formal com WhatsApp', 16, 30, 'whatsapp', 2, 3, 3),
('Cobrança 30+ dias', 'Cobrança intensa multi-canal', 31, NULL, 'todos', 1, 5, 4);