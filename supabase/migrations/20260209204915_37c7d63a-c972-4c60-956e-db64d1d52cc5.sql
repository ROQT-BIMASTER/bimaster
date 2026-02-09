
-- Tabela de mensagens de comunicação entre usuário e diretoria na revisão
CREATE TABLE public.fabrica_revisao_mensagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  revisao_id uuid NOT NULL REFERENCES public.fabrica_ficha_custo_revisoes(id) ON DELETE CASCADE,
  usuario_id uuid,
  usuario_nome text NOT NULL,
  conteudo text NOT NULL,
  tipo text NOT NULL DEFAULT 'usuario' CHECK (tipo IN ('usuario', 'diretoria')),
  insumo_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para busca por revisão
CREATE INDEX idx_fabrica_revisao_mensagens_revisao ON public.fabrica_revisao_mensagens(revisao_id);

-- RLS
ALTER TABLE public.fabrica_revisao_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view messages"
  ON public.fabrica_revisao_mensagens FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert messages"
  ON public.fabrica_revisao_mensagens FOR INSERT
  TO authenticated WITH CHECK (true);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.fabrica_revisao_mensagens;
