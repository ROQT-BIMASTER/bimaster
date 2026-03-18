
-- 1. Tabela de Juntadas Oficiais ao Processo
CREATE TABLE public.process_juntadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL,
  documento_titulo TEXT NOT NULL,
  documento_path TEXT,
  documento_url TEXT,
  folhas TEXT,
  tipo_documento TEXT NOT NULL DEFAULT 'outro',
  parecer TEXT,
  parecer_status TEXT NOT NULL DEFAULT 'pendente',
  juntado_por UUID,
  juntado_por_nome TEXT,
  departamento_id UUID REFERENCES public.departamentos(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_juntadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read juntadas"
  ON public.process_juntadas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert juntadas"
  ON public.process_juntadas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update juntadas"
  ON public.process_juntadas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 2. Tabela de Templates de Workflow Documental
CREATE TABLE public.process_doc_workflow_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento TEXT NOT NULL,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_doc_workflow_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read doc workflow config"
  ON public.process_doc_workflow_config FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage doc workflow config"
  ON public.process_doc_workflow_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Etapas de cada template
CREATE TABLE public.process_doc_workflow_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.process_doc_workflow_config(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  departamento_responsavel_id UUID REFERENCES public.departamentos(id),
  ordem INT NOT NULL DEFAULT 0,
  tipo_acao TEXT NOT NULL DEFAULT 'revisar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_doc_workflow_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read doc workflow etapas"
  ON public.process_doc_workflow_etapas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage doc workflow etapas"
  ON public.process_doc_workflow_etapas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Instâncias de subprocesso vinculadas a juntadas
CREATE TABLE public.process_doc_workflow_instancias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  juntada_id UUID NOT NULL REFERENCES public.process_juntadas(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES public.process_doc_workflow_config(id),
  etapa_atual INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_doc_workflow_instancias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read doc workflow instancias"
  ON public.process_doc_workflow_instancias FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage doc workflow instancias"
  ON public.process_doc_workflow_instancias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Transições / histórico de ações
CREATE TABLE public.process_doc_workflow_transicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id UUID NOT NULL REFERENCES public.process_doc_workflow_instancias(id) ON DELETE CASCADE,
  etapa_nome TEXT NOT NULL,
  acao TEXT NOT NULL,
  usuario_id UUID,
  usuario_nome TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_doc_workflow_transicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read doc workflow transicoes"
  ON public.process_doc_workflow_transicoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert doc workflow transicoes"
  ON public.process_doc_workflow_transicoes FOR INSERT TO authenticated WITH CHECK (true);

-- Indexes
CREATE INDEX idx_process_juntadas_process ON public.process_juntadas(process_id);
CREATE INDEX idx_doc_workflow_etapas_config ON public.process_doc_workflow_etapas(config_id);
CREATE INDEX idx_doc_workflow_instancias_juntada ON public.process_doc_workflow_instancias(juntada_id);
CREATE INDEX idx_doc_workflow_transicoes_instancia ON public.process_doc_workflow_transicoes(instancia_id);
