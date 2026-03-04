
-- Add produto_id to projeto_tarefas for product linking
ALTER TABLE public.projeto_tarefas ADD COLUMN IF NOT EXISTS produto_id uuid REFERENCES public.fabrica_produtos(id) ON DELETE SET NULL;

-- Add mentions array to comments
ALTER TABLE public.projeto_tarefa_comentarios ADD COLUMN IF NOT EXISTS mentions uuid[] DEFAULT '{}';

-- Create lateral chat messages table
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  conteudo text NOT NULL,
  mentions uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_tarefa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task messages" ON public.projeto_tarefa_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create task messages" ON public.projeto_tarefa_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_tarefa_messages;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_messages_tarefa ON public.projeto_tarefa_messages(tarefa_id, created_at);
