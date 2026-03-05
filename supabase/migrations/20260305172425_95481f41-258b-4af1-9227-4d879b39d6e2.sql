
-- Add tarefa_id and approval columns to projeto_briefings
ALTER TABLE public.projeto_briefings 
  ADD COLUMN IF NOT EXISTS tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  ALTER COLUMN secao_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS observacao_aprovacao text;

-- RLS policies for the new workflow (briefings linked to tasks)
-- Allow authenticated users to read briefings for their projects
CREATE POLICY "Users can read briefings" ON public.projeto_briefings
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert briefings" ON public.projeto_briefings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update briefings" ON public.projeto_briefings
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Users can delete briefings" ON public.projeto_briefings
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
