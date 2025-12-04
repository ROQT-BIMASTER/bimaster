-- Tabela para checklist de tarefas de marketing
CREATE TABLE public.marketing_task_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.lancamentos_tarefas_marketing(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  concluido BOOLEAN DEFAULT false,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  concluido_em TIMESTAMP WITH TIME ZONE,
  concluido_por UUID REFERENCES auth.users(id)
);

-- Tabela para arquivos de tarefas de marketing
CREATE TABLE public.marketing_task_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.lancamentos_tarefas_marketing(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  tipo VARCHAR(100),
  tamanho_bytes INTEGER,
  versao INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMP WITH TIME ZONE
);

-- Tabela para sessões de trabalho (timer)
CREATE TABLE public.marketing_work_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.lancamentos_tarefas_marketing(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  inicio TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fim TIMESTAMP WITH TIME ZONE,
  duracao_minutos INTEGER,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_task_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_task_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_work_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for marketing_task_checklist
CREATE POLICY "Usuários marketing podem ver checklist"
  ON public.marketing_task_checklist FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários marketing podem criar checklist"
  ON public.marketing_task_checklist FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários marketing podem atualizar checklist"
  ON public.marketing_task_checklist FOR UPDATE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários marketing podem deletar checklist"
  ON public.marketing_task_checklist FOR DELETE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

-- Policies for marketing_task_files
CREATE POLICY "Usuários marketing podem ver arquivos"
  ON public.marketing_task_files FOR SELECT
  USING (usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários marketing podem criar arquivos"
  ON public.marketing_task_files FOR INSERT
  WITH CHECK (usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários marketing podem atualizar arquivos"
  ON public.marketing_task_files FOR UPDATE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários marketing podem deletar arquivos"
  ON public.marketing_task_files FOR DELETE
  USING (usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

-- Policies for marketing_work_sessions
CREATE POLICY "Usuários podem ver suas sessões"
  ON public.marketing_work_sessions FOR SELECT
  USING (user_id = auth.uid() OR usuario_tem_permissao_modulo(auth.uid(), 'marketing'));

CREATE POLICY "Usuários podem criar suas sessões"
  ON public.marketing_work_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem atualizar suas sessões"
  ON public.marketing_work_sessions FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Usuários podem deletar suas sessões"
  ON public.marketing_work_sessions FOR DELETE
  USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_marketing_checklist_tarefa ON public.marketing_task_checklist(tarefa_id);
CREATE INDEX idx_marketing_files_tarefa ON public.marketing_task_files(tarefa_id);
CREATE INDEX idx_marketing_sessions_tarefa ON public.marketing_work_sessions(tarefa_id);
CREATE INDEX idx_marketing_sessions_user ON public.marketing_work_sessions(user_id);