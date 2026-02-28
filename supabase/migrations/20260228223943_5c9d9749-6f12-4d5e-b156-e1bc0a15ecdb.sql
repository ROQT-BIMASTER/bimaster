
-- Adicionar colunas de reply e menções na tabela de mensagens
ALTER TABLE public.fabrica_revisao_mensagens 
  ADD COLUMN IF NOT EXISTS resposta_a_id uuid REFERENCES public.fabrica_revisao_mensagens(id),
  ADD COLUMN IF NOT EXISTS mencoes jsonb DEFAULT '[]'::jsonb;

-- Adicionar colunas de status do chat na tabela de revisões
ALTER TABLE public.fabrica_ficha_custo_revisoes
  ADD COLUMN IF NOT EXISTS chat_status text DEFAULT 'aberto',
  ADD COLUMN IF NOT EXISTS chat_finalizado_por uuid,
  ADD COLUMN IF NOT EXISTS chat_finalizado_em timestamptz;

-- Índice para busca de replies
CREATE INDEX IF NOT EXISTS idx_revisao_mensagens_resposta_a ON public.fabrica_revisao_mensagens(resposta_a_id);

-- Índice para filtro por chat_status
CREATE INDEX IF NOT EXISTS idx_revisoes_chat_status ON public.fabrica_ficha_custo_revisoes(chat_status);
