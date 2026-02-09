
-- Create markup overrides table
CREATE TABLE public.fabrica_markup_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela_id UUID NOT NULL REFERENCES public.fabrica_tabelas_preco(id) ON DELETE CASCADE,
  linha TEXT,
  produto_id UUID REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  tipo_markup TEXT NOT NULL DEFAULT 'percentual',
  valor_markup NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  CONSTRAINT markup_override_target CHECK (linha IS NOT NULL OR produto_id IS NOT NULL),
  CONSTRAINT unique_override UNIQUE (tabela_id, linha, produto_id)
);

-- Enable RLS
ALTER TABLE public.fabrica_markup_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view markup overrides"
  ON public.fabrica_markup_overrides FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert markup overrides"
  ON public.fabrica_markup_overrides FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update markup overrides"
  ON public.fabrica_markup_overrides FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete markup overrides"
  ON public.fabrica_markup_overrides FOR DELETE
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_fabrica_markup_overrides_updated_at
  BEFORE UPDATE ON public.fabrica_markup_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
