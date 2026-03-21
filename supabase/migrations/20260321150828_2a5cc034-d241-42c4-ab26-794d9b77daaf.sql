
CREATE TABLE public.trade_displays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT,
  descricao TEXT,
  categoria TEXT,
  largura_cm NUMERIC,
  profundidade_cm NUMERIC,
  altura_cm NUMERIC,
  material TEXT,
  foto_url TEXT,
  fotos_extras JSONB DEFAULT '[]',
  ativo BOOLEAN DEFAULT true,
  posicao INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.trade_displays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage trade_displays"
  ON public.trade_displays FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view active trade_displays"
  ON public.trade_displays FOR SELECT
  TO authenticated
  USING (ativo = true);
