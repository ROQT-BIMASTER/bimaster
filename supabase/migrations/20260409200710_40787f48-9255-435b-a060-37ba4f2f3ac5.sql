
CREATE TABLE public.projeto_produto_vinculos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.fabrica_produtos(id) ON DELETE CASCADE,
  origem TEXT NOT NULL DEFAULT 'brasil' CHECK (origem IN ('brasil', 'china')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(projeto_id, produto_id)
);

ALTER TABLE public.projeto_produto_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view projeto_produto_vinculos"
  ON public.projeto_produto_vinculos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert projeto_produto_vinculos"
  ON public.projeto_produto_vinculos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete projeto_produto_vinculos"
  ON public.projeto_produto_vinculos FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_projeto_produto_vinculos_projeto ON public.projeto_produto_vinculos(projeto_id);
CREATE INDEX idx_projeto_produto_vinculos_produto ON public.projeto_produto_vinculos(produto_id);
