
-- Table for China ↔ Brasil chat messages
CREATE TABLE public.china_chat_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  usuario_nome text NOT NULL,
  conteudo text NOT NULL,
  tipo text NOT NULL DEFAULT 'brasil',
  ref_tipo text,
  ref_id text,
  ref_label text,
  resposta_a_id uuid REFERENCES public.china_chat_mensagens(id),
  mencoes jsonb DEFAULT '[]'::jsonb,
  lida_por jsonb DEFAULT '[]'::jsonb,
  anexos jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add chat_status column to submissoes
ALTER TABLE public.china_produto_submissoes
  ADD COLUMN IF NOT EXISTS chat_status text DEFAULT 'aberto';

-- Enable RLS
ALTER TABLE public.china_chat_mensagens ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read chat messages"
  ON public.china_chat_mensagens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert chat messages"
  ON public.china_chat_mensagens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update their own messages"
  ON public.china_chat_mensagens FOR UPDATE
  TO authenticated
  USING (auth.uid() = usuario_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.china_chat_mensagens;

-- Index for performance
CREATE INDEX idx_china_chat_submissao ON public.china_chat_mensagens(submissao_id, created_at);
