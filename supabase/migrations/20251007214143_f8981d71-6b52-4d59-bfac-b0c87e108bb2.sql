-- Criar tabela para fotos ideais do PDV
CREATE TABLE IF NOT EXISTS public.ideal_pdv_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category VARCHAR NOT NULL,
  photo_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.ideal_pdv_photos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Acesso total ideal_pdv_photos"
  ON public.ideal_pdv_photos
  FOR ALL
  USING (true);

-- Criar tabela para fotos de comparação de concorrentes
CREATE TABLE IF NOT EXISTS public.competitor_comparison_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID REFERENCES public.competitors(id),
  photo_url TEXT NOT NULL,
  photo_type VARCHAR NOT NULL CHECK (photo_type IN ('competitor', 'our_product')),
  store_id UUID REFERENCES public.stores(id),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.competitor_comparison_photos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Acesso total competitor_comparison_photos"
  ON public.competitor_comparison_photos
  FOR ALL
  USING (true);