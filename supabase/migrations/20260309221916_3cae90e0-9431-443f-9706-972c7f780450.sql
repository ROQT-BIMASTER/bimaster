
-- 1. Tabela de aprovações multi-etapa
CREATE TABLE public.projeto_tarefa_aprovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  aprovador_id uuid,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tarefa_id, etapa)
);

ALTER TABLE public.projeto_tarefa_aprovacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view aprovacoes for accessible projects"
ON public.projeto_tarefa_aprovacoes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    JOIN public.projetos p ON p.id = pt.projeto_id
    WHERE pt.id = projeto_tarefa_aprovacoes.tarefa_id
    AND p.criador_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    JOIN public.projeto_membros pm ON pm.projeto_id = pt.projeto_id
    WHERE pt.id = projeto_tarefa_aprovacoes.tarefa_id
    AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can insert aprovacoes"
ON public.projeto_tarefa_aprovacoes
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update aprovacoes"
ON public.projeto_tarefa_aprovacoes
FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete aprovacoes"
ON public.projeto_tarefa_aprovacoes
FOR DELETE TO authenticated
USING (true);

-- 2. Colunas de retrabalho na tabela projeto_tarefas
ALTER TABLE public.projeto_tarefas ADD COLUMN IF NOT EXISTS tipo_tarefa text DEFAULT 'padrao';
ALTER TABLE public.projeto_tarefas ADD COLUMN IF NOT EXISTS motivo_retrabalho text;
