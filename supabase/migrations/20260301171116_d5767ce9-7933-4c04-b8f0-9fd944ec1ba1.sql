
-- Create table for kit/display composition (grade items)
CREATE TABLE public.fabrica_produto_grade_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_pai_id UUID NOT NULL REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  produto_filho_id UUID NOT NULL REFERENCES public.fabrica_produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(produto_pai_id, produto_filho_id)
);

-- Indexes
CREATE INDEX idx_grade_itens_pai ON public.fabrica_produto_grade_itens(produto_pai_id);
CREATE INDEX idx_grade_itens_filho ON public.fabrica_produto_grade_itens(produto_filho_id);

-- Enable RLS
ALTER TABLE public.fabrica_produto_grade_itens ENABLE ROW LEVEL SECURITY;

-- RLS policies - authenticated users can CRUD
CREATE POLICY "Authenticated users can view grade items"
  ON public.fabrica_produto_grade_itens FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert grade items"
  ON public.fabrica_produto_grade_itens FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update grade items"
  ON public.fabrica_produto_grade_itens FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete grade items"
  ON public.fabrica_produto_grade_itens FOR DELETE
  TO authenticated USING (true);
