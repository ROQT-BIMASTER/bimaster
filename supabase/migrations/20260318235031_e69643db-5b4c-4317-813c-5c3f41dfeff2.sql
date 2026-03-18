
-- Table: china_ficha_visibilidade
CREATE TABLE public.china_ficha_visibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pode_despachar BOOLEAN NOT NULL DEFAULT false,
  concedido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (submissao_id, user_id)
);

ALTER TABLE public.china_ficha_visibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view visibility records"
  ON public.china_ficha_visibilidade FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert visibility records"
  ON public.china_ficha_visibilidade FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete visibility records"
  ON public.china_ficha_visibilidade FOR DELETE TO authenticated
  USING (true);

-- Table: china_ficha_despachos
CREATE TABLE public.china_ficha_despachos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  modulo_destino TEXT NOT NULL,
  usuario_destino_id UUID REFERENCES auth.users(id),
  observacao TEXT,
  despachado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.china_ficha_despachos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view despachos"
  ON public.china_ficha_despachos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert despachos"
  ON public.china_ficha_despachos FOR INSERT TO authenticated
  WITH CHECK (true);
