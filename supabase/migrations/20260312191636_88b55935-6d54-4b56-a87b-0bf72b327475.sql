
-- Grade items for imported product kits (mirrors fabrica_produto_grade_itens)
CREATE TABLE IF NOT EXISTS public.produto_brasil_grade_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_pai_id UUID NOT NULL REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  produto_filho_id UUID NOT NULL REFERENCES public.produtos_brasil(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  cor_numero TEXT,
  cor_hex TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT produto_brasil_grade_itens_unique UNIQUE (produto_pai_id, produto_filho_id)
);

ALTER TABLE public.produto_brasil_grade_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage grade items"
  ON public.produto_brasil_grade_itens
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
