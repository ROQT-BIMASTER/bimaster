
CREATE TABLE public.process_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL,
  user_id UUID NOT NULL,
  user_nome TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  modulo_origem TEXT,
  tipo TEXT NOT NULL DEFAULT 'mensagem',
  documento_ids UUID[] DEFAULT '{}',
  documento_oficializado_id UUID,
  fase_processo TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.process_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chat messages"
  ON public.process_chat_messages FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert chat messages"
  ON public.process_chat_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_process_chat_process_id ON public.process_chat_messages(process_id);
CREATE INDEX idx_process_chat_created_at ON public.process_chat_messages(created_at);

ALTER PUBLICATION supabase_realtime ADD TABLE public.process_chat_messages;
