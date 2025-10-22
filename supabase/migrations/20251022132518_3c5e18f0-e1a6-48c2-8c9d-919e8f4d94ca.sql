-- Criar tabela para nossos produtos
CREATE TABLE IF NOT EXISTS public.our_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  category VARCHAR(100),
  description TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Criar tabela para produtos de concorrentes
CREATE TABLE IF NOT EXISTS public.competitor_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID REFERENCES public.competitors(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  price NUMERIC(10,2),
  description TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  market_presence VARCHAR(50),
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Criar tabela de comparação (relacionamento entre nossos produtos e produtos concorrentes)
CREATE TABLE IF NOT EXISTS public.product_comparisons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  our_product_id UUID REFERENCES public.our_products(id) ON DELETE CASCADE,
  competitor_product_id UUID REFERENCES public.competitor_products(id) ON DELETE CASCADE,
  similarity_score NUMERIC(3,2),
  comparison_notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  UNIQUE(our_product_id, competitor_product_id)
);

-- Enable RLS
ALTER TABLE public.our_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitor_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_comparisons ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para our_products
CREATE POLICY "Usuários podem criar produtos"
  ON public.our_products FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Usuários podem ver produtos"
  ON public.our_products FOR SELECT
  USING (true);

CREATE POLICY "Criadores podem atualizar seus produtos"
  ON public.our_products FOR UPDATE
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins podem deletar produtos"
  ON public.our_products FOR DELETE
  USING (is_admin_or_supervisor(auth.uid()));

-- Políticas RLS para competitor_products
CREATE POLICY "Usuários podem criar produtos concorrentes"
  ON public.competitor_products FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Usuários podem ver produtos concorrentes"
  ON public.competitor_products FOR SELECT
  USING (true);

CREATE POLICY "Criadores podem atualizar produtos concorrentes"
  ON public.competitor_products FOR UPDATE
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins podem deletar produtos concorrentes"
  ON public.competitor_products FOR DELETE
  USING (is_admin_or_supervisor(auth.uid()));

-- Políticas RLS para product_comparisons
CREATE POLICY "Usuários podem criar comparações"
  ON public.product_comparisons FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Usuários podem ver comparações"
  ON public.product_comparisons FOR SELECT
  USING (true);

CREATE POLICY "Criadores podem atualizar comparações"
  ON public.product_comparisons FOR UPDATE
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins podem deletar comparações"
  ON public.product_comparisons FOR DELETE
  USING (is_admin_or_supervisor(auth.uid()));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_our_products_category ON public.our_products(category);
CREATE INDEX IF NOT EXISTS idx_competitor_products_competitor ON public.competitor_products(competitor_id);
CREATE INDEX IF NOT EXISTS idx_product_comparisons_our ON public.product_comparisons(our_product_id);
CREATE INDEX IF NOT EXISTS idx_product_comparisons_competitor ON public.product_comparisons(competitor_product_id);

-- Comentários
COMMENT ON TABLE public.our_products IS 'Catálogo de nossos produtos para comparação competitiva';
COMMENT ON TABLE public.competitor_products IS 'Produtos dos concorrentes identificados no mercado';
COMMENT ON TABLE public.product_comparisons IS 'Relacionamento e comparação entre nossos produtos e produtos concorrentes';