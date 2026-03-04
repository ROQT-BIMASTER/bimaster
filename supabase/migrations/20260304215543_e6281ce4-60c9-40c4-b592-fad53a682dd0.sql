
-- Tabela de Projetos
CREATE TABLE public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  cor text DEFAULT '#6366f1',
  icone text DEFAULT 'folder',
  criador_id uuid NOT NULL,
  status text DEFAULT 'ativo',
  visibilidade text DEFAULT 'equipe',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de Seções
CREATE TABLE public.projeto_secoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Tabela de Tarefas
CREATE TABLE public.projeto_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  secao_id uuid NOT NULL REFERENCES public.projeto_secoes(id) ON DELETE CASCADE,
  parent_tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  responsavel_id uuid,
  status text DEFAULT 'pendente',
  prioridade text DEFAULT 'media',
  data_prazo date,
  data_conclusao date,
  codigo text,
  visibilidade text DEFAULT 'equipe',
  ordem int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de Colaboradores por Tarefa (N:N)
CREATE TABLE public.projeto_tarefa_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tarefa_id, user_id)
);

-- Tabela de Atividades do Projeto
CREATE TABLE public.projeto_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  descricao text,
  metadata jsonb DEFAULT '{}',
  lida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_projeto_secoes_projeto ON public.projeto_secoes(projeto_id);
CREATE INDEX idx_projeto_tarefas_secao ON public.projeto_tarefas(secao_id);
CREATE INDEX idx_projeto_tarefas_projeto ON public.projeto_tarefas(projeto_id);
CREATE INDEX idx_projeto_tarefas_parent ON public.projeto_tarefas(parent_tarefa_id);
CREATE INDEX idx_projeto_tarefas_responsavel ON public.projeto_tarefas(responsavel_id);
CREATE INDEX idx_projeto_atividades_projeto ON public.projeto_atividades(projeto_id);
CREATE INDEX idx_projeto_atividades_user ON public.projeto_atividades(user_id);

-- Enable RLS
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_tarefa_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_atividades ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users can CRUD
CREATE POLICY "Authenticated users can view projetos" ON public.projetos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert projetos" ON public.projetos FOR INSERT TO authenticated WITH CHECK (auth.uid() = criador_id);
CREATE POLICY "Authenticated users can update projetos" ON public.projetos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete projetos" ON public.projetos FOR DELETE TO authenticated USING (auth.uid() = criador_id);

CREATE POLICY "Authenticated users can view projeto_secoes" ON public.projeto_secoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert projeto_secoes" ON public.projeto_secoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update projeto_secoes" ON public.projeto_secoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete projeto_secoes" ON public.projeto_secoes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view projeto_tarefas" ON public.projeto_tarefas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert projeto_tarefas" ON public.projeto_tarefas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update projeto_tarefas" ON public.projeto_tarefas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete projeto_tarefas" ON public.projeto_tarefas FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view projeto_tarefa_colaboradores" ON public.projeto_tarefa_colaboradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert projeto_tarefa_colaboradores" ON public.projeto_tarefa_colaboradores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete projeto_tarefa_colaboradores" ON public.projeto_tarefa_colaboradores FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view projeto_atividades" ON public.projeto_atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert projeto_atividades" ON public.projeto_atividades FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update projeto_atividades" ON public.projeto_atividades FOR UPDATE TO authenticated USING (true);
