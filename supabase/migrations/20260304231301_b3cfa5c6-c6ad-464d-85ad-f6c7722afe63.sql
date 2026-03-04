
-- 1. Create projeto_tarefa_validacoes table
CREATE TABLE public.projeto_tarefa_validacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  solicitado_por uuid NOT NULL,
  aprovado_por uuid,
  aprovado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_tarefa_validacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage validacoes"
  ON public.projeto_tarefa_validacoes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. Add columns to fabrica_revisao_documentos
ALTER TABLE public.fabrica_revisao_documentos
  ADD COLUMN IF NOT EXISTS origem_projeto_tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visivel_fabrica boolean NOT NULL DEFAULT true;

-- 3. Add validacao_status to projeto_tarefas
ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS validacao_status text;
