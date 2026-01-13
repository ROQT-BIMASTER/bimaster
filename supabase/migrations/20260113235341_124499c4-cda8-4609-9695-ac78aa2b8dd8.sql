
-- COMPLETE MARKETING MISSION CONTROL RESTRUCTURE (FINAL)
-- All column names verified against existing schema

-- =====================================================
-- PHASE 0: Create helper function first
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_marketing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================
-- PHASE 1: Core Campaign and Workflow Tables
-- =====================================================

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.marketing_campanhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) DEFAULT 'marketing',
  status VARCHAR(50) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'planejamento', 'em_andamento', 'pausada', 'concluida', 'cancelada')),
  data_inicio DATE,
  data_fim DATE,
  orcamento DECIMAL(15,2),
  orcamento_utilizado DECIMAL(15,2) DEFAULT 0,
  objetivo TEXT,
  kpis JSONB DEFAULT '[]',
  progresso INTEGER DEFAULT 0 CHECK (progresso >= 0 AND progresso <= 100),
  lancamento_id UUID,
  responsavel_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Workflow stages table
CREATE TABLE IF NOT EXISTS public.marketing_workflow_etapas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  cor VARCHAR(20) DEFAULT '#6366f1',
  icone VARCHAR(50),
  tipo VARCHAR(50) DEFAULT 'etapa' CHECK (tipo IN ('etapa', 'aprovacao', 'revisao', 'entrega')),
  requer_aprovacao BOOLEAN DEFAULT false,
  aprovador_papel VARCHAR(50),
  sla_horas INTEGER,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Approvals table
CREATE TABLE IF NOT EXISTS public.marketing_aprovacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.lancamentos_tarefas_marketing(id) ON DELETE CASCADE,
  etapa_id UUID REFERENCES public.marketing_workflow_etapas(id),
  aprovador_id UUID REFERENCES auth.users(id),
  status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'revisao_solicitada')),
  comentario TEXT,
  data_solicitacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_resposta TIMESTAMP WITH TIME ZONE,
  versao INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS public.marketing_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('prazo', 'bloqueio', 'aprovacao', 'sla', 'dependencia', 'sistema')),
  severidade VARCHAR(20) DEFAULT 'info' CHECK (severidade IN ('info', 'warning', 'error', 'critical')),
  titulo VARCHAR(200) NOT NULL,
  mensagem TEXT,
  entidade_tipo VARCHAR(50),
  entidade_id UUID,
  destinatario_id UUID REFERENCES auth.users(id),
  lido BOOLEAN DEFAULT false,
  lido_em TIMESTAMP WITH TIME ZONE,
  acao_url TEXT,
  dados JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- SLA configuration table
CREATE TABLE IF NOT EXISTS public.marketing_sla_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_tarefa VARCHAR(50) NOT NULL,
  etapa_id UUID REFERENCES public.marketing_workflow_etapas(id),
  horas_limite INTEGER NOT NULL,
  horas_alerta INTEGER,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Roles table
CREATE TABLE IF NOT EXISTS public.marketing_papeis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  descricao TEXT,
  permissoes JSONB DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all Phase 1 tables
ALTER TABLE public.marketing_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_workflow_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_sla_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_papeis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Phase 1
CREATE POLICY "Authenticated users can view campaigns" ON public.marketing_campanhas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage campaigns" ON public.marketing_campanhas FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view workflow stages" ON public.marketing_workflow_etapas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage workflow stages" ON public.marketing_workflow_etapas FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view approvals" ON public.marketing_aprovacoes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage approvals" ON public.marketing_aprovacoes FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their alerts" ON public.marketing_alertas FOR SELECT USING (auth.uid() IS NOT NULL AND (destinatario_id = auth.uid() OR destinatario_id IS NULL));
CREATE POLICY "Authenticated users can manage alerts" ON public.marketing_alertas FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view SLA config" ON public.marketing_sla_config FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage SLA config" ON public.marketing_sla_config FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view roles" ON public.marketing_papeis FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can manage roles" ON public.marketing_papeis FOR ALL USING (auth.uid() IS NOT NULL);

-- Phase 1 Indexes
CREATE INDEX idx_campanhas_status ON public.marketing_campanhas(status);
CREATE INDEX idx_campanhas_lancamento ON public.marketing_campanhas(lancamento_id);
CREATE INDEX idx_campanhas_responsavel ON public.marketing_campanhas(responsavel_id);
CREATE INDEX idx_workflow_etapas_ordem ON public.marketing_workflow_etapas(ordem);
CREATE INDEX idx_aprovacoes_tarefa ON public.marketing_aprovacoes(tarefa_id);
CREATE INDEX idx_aprovacoes_status ON public.marketing_aprovacoes(status);
CREATE INDEX idx_alertas_destinatario ON public.marketing_alertas(destinatario_id);
CREATE INDEX idx_alertas_lido ON public.marketing_alertas(lido);
CREATE INDEX idx_alertas_tipo ON public.marketing_alertas(tipo);

-- Phase 1 Triggers
CREATE TRIGGER update_marketing_campanhas_updated_at
  BEFORE UPDATE ON public.marketing_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_marketing_updated_at();

CREATE TRIGGER update_marketing_workflow_etapas_updated_at
  BEFORE UPDATE ON public.marketing_workflow_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_marketing_updated_at();

CREATE TRIGGER update_marketing_sla_config_updated_at
  BEFORE UPDATE ON public.marketing_sla_config
  FOR EACH ROW EXECUTE FUNCTION public.update_marketing_updated_at();

-- =====================================================
-- PHASE 1.5: Add columns to existing tasks table
-- =====================================================

ALTER TABLE public.lancamentos_tarefas_marketing 
  ADD COLUMN IF NOT EXISTS campanha_id UUID REFERENCES public.marketing_campanhas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS etapa_atual_id UUID REFERENCES public.marketing_workflow_etapas(id),
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(50) DEFAULT 'nao_iniciado',
  ADD COLUMN IF NOT EXISTS sla_deadline TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) DEFAULT 'dentro',
  ADD COLUMN IF NOT EXISTS bloqueada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_bloqueio TEXT,
  ADD COLUMN IF NOT EXISTS template_id UUID,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- =====================================================
-- PHASE 2: Templates and Automations
-- =====================================================

DROP TABLE IF EXISTS public.marketing_automacoes_log CASCADE;
DROP TABLE IF EXISTS public.marketing_automacoes CASCADE;
DROP TABLE IF EXISTS public.marketing_templates CASCADE;

CREATE TABLE public.marketing_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('tarefa', 'workflow', 'campanha')),
  descricao TEXT,
  configuracao JSONB NOT NULL DEFAULT '{}',
  etapas_workflow JSONB DEFAULT '[]',
  checklist_padrao JSONB DEFAULT '[]',
  sla_dias INTEGER,
  pontos_base INTEGER DEFAULT 10,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.marketing_automacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  tipo_gatilho VARCHAR(50) NOT NULL CHECK (tipo_gatilho IN ('status_change', 'deadline_approaching', 'approval_complete', 'task_complete', 'schedule')),
  condicoes JSONB NOT NULL DEFAULT '{}',
  acoes JSONB NOT NULL DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  prioridade INTEGER DEFAULT 0,
  ultima_execucao TIMESTAMP WITH TIME ZONE,
  execucoes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE public.marketing_automacoes_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automacao_id UUID REFERENCES public.marketing_automacoes(id) ON DELETE CASCADE,
  entidade_tipo VARCHAR(50) NOT NULL,
  entidade_id UUID NOT NULL,
  gatilho_dados JSONB,
  acoes_executadas JSONB,
  sucesso BOOLEAN DEFAULT true,
  erro_mensagem TEXT,
  executado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_automacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_automacoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View templates" ON public.marketing_templates FOR SELECT USING (auth.uid() IS NOT NULL AND ativo = true);
CREATE POLICY "Manage templates" ON public.marketing_templates FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "View automations" ON public.marketing_automacoes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manage automations" ON public.marketing_automacoes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "View automation logs" ON public.marketing_automacoes_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Insert automation logs" ON public.marketing_automacoes_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_templates_tipo ON public.marketing_templates(tipo);
CREATE INDEX idx_templates_ativo ON public.marketing_templates(ativo);
CREATE INDEX idx_automacoes_tipo_gatilho ON public.marketing_automacoes(tipo_gatilho);
CREATE INDEX idx_automacoes_ativo ON public.marketing_automacoes(ativo);
CREATE INDEX idx_automacoes_log_automacao ON public.marketing_automacoes_log(automacao_id);

CREATE TRIGGER update_marketing_templates_updated_at
  BEFORE UPDATE ON public.marketing_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_marketing_updated_at();

CREATE TRIGGER update_marketing_automacoes_updated_at
  BEFORE UPDATE ON public.marketing_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_marketing_updated_at();

-- =====================================================
-- PHASE 3: Task Dependencies
-- =====================================================

CREATE TABLE IF NOT EXISTS public.marketing_tarefas_dependencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.lancamentos_tarefas_marketing(id) ON DELETE CASCADE,
  depende_de_id UUID NOT NULL REFERENCES public.lancamentos_tarefas_marketing(id) ON DELETE CASCADE,
  tipo_dependencia VARCHAR(50) DEFAULT 'finish_to_start',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tarefa_id, depende_de_id)
);

ALTER TABLE public.marketing_tarefas_dependencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View dependencies" ON public.marketing_tarefas_dependencias FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manage dependencies" ON public.marketing_tarefas_dependencias FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_dependencias_tarefa ON public.marketing_tarefas_dependencias(tarefa_id);
CREATE INDEX idx_dependencias_depende ON public.marketing_tarefas_dependencias(depende_de_id);

-- =====================================================
-- PHASE 4: Performance Indexes (using correct column names)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_tarefas_marketing_campanha ON public.lancamentos_tarefas_marketing(campanha_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_marketing_status ON public.lancamentos_tarefas_marketing(status);
CREATE INDEX IF NOT EXISTS idx_tarefas_marketing_responsavel ON public.lancamentos_tarefas_marketing(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_marketing_etapa ON public.lancamentos_tarefas_marketing(etapa_atual_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_marketing_data_prazo ON public.lancamentos_tarefas_marketing(data_prazo);
CREATE INDEX IF NOT EXISTS idx_tarefas_marketing_prioridade ON public.lancamentos_tarefas_marketing(prioridade_ai);

-- =====================================================
-- PHASE 5: Default Data
-- =====================================================

INSERT INTO public.marketing_workflow_etapas (nome, descricao, ordem, cor, tipo, requer_aprovacao) VALUES
('Briefing', 'Definição do escopo e objetivos', 1, '#3b82f6', 'etapa', false),
('Criação', 'Desenvolvimento do conteúdo/material', 2, '#8b5cf6', 'etapa', false),
('Revisão Interna', 'Revisão pela equipe', 3, '#f59e0b', 'revisao', false),
('Aprovação', 'Aprovação do gestor/cliente', 4, '#ef4444', 'aprovacao', true),
('Ajustes', 'Correções solicitadas', 5, '#f97316', 'etapa', false),
('Entrega', 'Publicação/Entrega final', 6, '#22c55e', 'entrega', false);

INSERT INTO public.marketing_templates (nome, tipo, descricao, configuracao, checklist_padrao, sla_dias, pontos_base) VALUES
('Post Redes Sociais', 'tarefa', 'Template para criação de posts em redes sociais', 
 '{"tipo_tarefa": "post_social", "requer_aprovacao": true}',
 '[{"titulo": "Criar copy", "ordem": 1}, {"titulo": "Criar visual", "ordem": 2}, {"titulo": "Revisar", "ordem": 3}, {"titulo": "Aprovar", "ordem": 4}]',
 2, 10),
('Campanha Lançamento', 'campanha', 'Template para campanhas de lançamento de produto',
 '{"tipo": "lancamento", "canais": ["instagram", "facebook", "email"]}',
 '[{"titulo": "Definir objetivos", "ordem": 1}, {"titulo": "Criar cronograma", "ordem": 2}, {"titulo": "Produzir materiais", "ordem": 3}, {"titulo": "Aprovar campanha", "ordem": 4}]',
 30, 100),
('Vídeo Marketing', 'tarefa', 'Template para produção de vídeos',
 '{"tipo_tarefa": "video", "requer_aprovacao": true}',
 '[{"titulo": "Escrever roteiro", "ordem": 1}, {"titulo": "Aprovar roteiro", "ordem": 2}, {"titulo": "Gravar", "ordem": 3}, {"titulo": "Editar", "ordem": 4}, {"titulo": "Revisão final", "ordem": 5}]',
 7, 50),
('Email Marketing', 'tarefa', 'Template para criação de emails',
 '{"tipo_tarefa": "email", "requer_aprovacao": true}',
 '[{"titulo": "Definir objetivo", "ordem": 1}, {"titulo": "Criar copy", "ordem": 2}, {"titulo": "Design template", "ordem": 3}, {"titulo": "Testar links", "ordem": 4}, {"titulo": "Aprovar", "ordem": 5}]',
 3, 20);

INSERT INTO public.marketing_automacoes (nome, descricao, tipo_gatilho, condicoes, acoes) VALUES
('Alerta Prazo Próximo', 'Notifica quando prazo está chegando', 'deadline_approaching',
 '{"dias_antes": 2}',
 '[{"tipo": "criar_alerta", "severidade": "warning", "mensagem": "Prazo em 2 dias"}]'),
('Atualizar Status Campanha', 'Atualiza progresso da campanha quando tarefa é concluída', 'task_complete',
 '{}',
 '[{"tipo": "atualizar_campanha", "campo": "progresso"}]'),
('Notificar Aprovador', 'Envia alerta quando tarefa precisa de aprovação', 'status_change',
 '{"novo_status": "aguardando_aprovacao"}',
 '[{"tipo": "criar_alerta", "severidade": "info", "destinatario": "aprovador"}]');

INSERT INTO public.marketing_papeis (nome, codigo, descricao, permissoes) VALUES
('Gerente de Marketing', 'gerente_mkt', 'Acesso total ao módulo de marketing', '["criar_campanha", "aprovar_tarefas", "gerenciar_equipe", "visualizar_relatorios"]'),
('Coordenador', 'coordenador', 'Coordena equipes e projetos', '["criar_tarefas", "aprovar_tarefas", "visualizar_relatorios"]'),
('Analista', 'analista', 'Executa e acompanha tarefas', '["criar_tarefas", "editar_tarefas", "visualizar_relatorios"]'),
('Designer', 'designer', 'Cria materiais visuais', '["criar_tarefas", "editar_tarefas"]'),
('Redator', 'redator', 'Cria conteúdo textual', '["criar_tarefas", "editar_tarefas"]');

INSERT INTO public.marketing_sla_config (tipo_tarefa, horas_limite, horas_alerta) VALUES
('post_social', 24, 20),
('video', 168, 144),
('email', 48, 36),
('banner', 24, 20),
('campanha', 720, 648);
