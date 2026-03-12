
-- Table: produto_brasil_imagens
CREATE TABLE public.produto_brasil_imagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid REFERENCES public.produtos_brasil(id) ON DELETE CASCADE NOT NULL,
  image_url text NOT NULL,
  image_path text,
  etapa text NOT NULL DEFAULT 'china_source',
  origem text NOT NULL DEFAULT 'china_supplier',
  descricao text,
  uploaded_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.produto_brasil_imagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage produto_brasil_imagens"
ON public.produto_brasil_imagens
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Table: produto_brasil_historico
CREATE TABLE public.produto_brasil_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_brasil_id uuid REFERENCES public.produtos_brasil(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL,
  descricao text,
  user_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.produto_brasil_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage produto_brasil_historico"
ON public.produto_brasil_historico
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('produto-brasil-imagens', 'produto-brasil-imagens', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload produto images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'produto-brasil-imagens');

CREATE POLICY "Anyone can view produto images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'produto-brasil-imagens');

CREATE POLICY "Authenticated users can delete produto images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'produto-brasil-imagens');
