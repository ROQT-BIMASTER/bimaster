
CREATE TABLE IF NOT EXISTS public.chat_tarefas_origem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  mensagem_id uuid NOT NULL REFERENCES public.mensagens(id) ON DELETE CASCADE,
  conversa_id uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  criado_por uuid NOT NULL,
  agente_id uuid,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tarefa_id, mensagem_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_tarefas_origem_tarefa ON public.chat_tarefas_origem(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_chat_tarefas_origem_mensagem ON public.chat_tarefas_origem(mensagem_id);
CREATE INDEX IF NOT EXISTS idx_chat_tarefas_origem_conversa ON public.chat_tarefas_origem(conversa_id);

ALTER TABLE public.chat_tarefas_origem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_tarefas_origem_select"
ON public.chat_tarefas_origem FOR SELECT
TO authenticated
USING (
  criado_por = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = chat_tarefas_origem.conversa_id
      AND cp.usuario_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projeto_tarefas t
    JOIN public.projeto_membros pm ON pm.projeto_id = t.projeto_id
    WHERE t.id = chat_tarefas_origem.tarefa_id
      AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "chat_tarefas_origem_insert"
ON public.chat_tarefas_origem FOR INSERT
TO authenticated
WITH CHECK (criado_por = auth.uid());

CREATE POLICY "chat_tarefas_origem_delete"
ON public.chat_tarefas_origem FOR DELETE
TO authenticated
USING (criado_por = auth.uid());
