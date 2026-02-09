
-- Tabela de requisitos obrigatórios da revisão
CREATE TABLE public.fabrica_revisao_requisitos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  revisao_id UUID NOT NULL REFERENCES public.fabrica_ficha_custo_revisoes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'outro',
  quantidade_minima INTEGER DEFAULT 1,
  insumo_id UUID,
  cumprido BOOLEAN NOT NULL DEFAULT false,
  cumprido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX idx_fabrica_revisao_requisitos_revisao ON public.fabrica_revisao_requisitos(revisao_id);

-- RLS
ALTER TABLE public.fabrica_revisao_requisitos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can select requisitos"
  ON public.fabrica_revisao_requisitos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert requisitos"
  ON public.fabrica_revisao_requisitos FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update requisitos"
  ON public.fabrica_revisao_requisitos FOR UPDATE
  TO authenticated USING (true);
