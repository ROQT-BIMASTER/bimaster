-- Criar tabela para auditorias de gôndola
CREATE TABLE public.gondola_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES public.visits(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  preco_praticado NUMERIC,
  produto_presente BOOLEAN NOT NULL DEFAULT true,
  quantidade_frentes INTEGER DEFAULT 0,
  conforme_planograma BOOLEAN DEFAULT false,
  concorrentes_presentes BOOLEAN DEFAULT false,
  concorrentes_detalhes JSONB DEFAULT '[]'::jsonb,
  observacoes TEXT,
  photo_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE public.gondola_audits ENABLE ROW LEVEL SECURITY;

-- Política de acesso total
CREATE POLICY "Acesso total gondola_audits"
ON public.gondola_audits
FOR ALL
USING (true);

-- Índices para melhor performance
CREATE INDEX idx_gondola_audits_visit ON public.gondola_audits(visit_id);
CREATE INDEX idx_gondola_audits_store ON public.gondola_audits(store_id);
CREATE INDEX idx_gondola_audits_product ON public.gondola_audits(product_id);

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.gondola_audits;