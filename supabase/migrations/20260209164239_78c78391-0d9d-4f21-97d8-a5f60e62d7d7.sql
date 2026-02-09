
-- Tabela de bloqueios de visibilidade de produtos/linhas
CREATE TABLE public.fabrica_produto_visibility_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('linha', 'produto')),
  linha TEXT,
  produto_id UUID REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  motivo TEXT,
  blocked_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_block UNIQUE (tipo, linha, produto_id),
  CONSTRAINT valid_block CHECK (
    (tipo = 'linha' AND linha IS NOT NULL AND produto_id IS NULL) OR
    (tipo = 'produto' AND produto_id IS NOT NULL AND linha IS NULL)
  )
);

-- Enable RLS
ALTER TABLE public.fabrica_produto_visibility_blocks ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read blocks (needed for filtering)
CREATE POLICY "Authenticated users can view blocks"
  ON public.fabrica_produto_visibility_blocks
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins/supervisors can insert blocks
CREATE POLICY "Admins can insert blocks"
  ON public.fabrica_produto_visibility_blocks
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only admins/supervisors can delete blocks
CREATE POLICY "Admins can delete blocks"
  ON public.fabrica_produto_visibility_blocks
  FOR DELETE
  USING (auth.uid() IS NOT NULL);
