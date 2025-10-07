-- Verificar e criar tabelas apenas se não existirem
DO $$ 
BEGIN
  -- Criar tabela para fotos ideais do PDV se não existir
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'ideal_pdv_photos') THEN
    CREATE TABLE public.ideal_pdv_photos (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      category VARCHAR NOT NULL,
      photo_url TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
      created_by UUID REFERENCES auth.users(id)
    );

    ALTER TABLE public.ideal_pdv_photos ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Acesso total ideal_pdv_photos"
      ON public.ideal_pdv_photos
      FOR ALL
      USING (true);
  END IF;

  -- Criar tabela para fotos de comparação de concorrentes se não existir
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'competitor_comparison_photos') THEN
    CREATE TABLE public.competitor_comparison_photos (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      competitor_id UUID REFERENCES public.competitors(id),
      photo_url TEXT NOT NULL,
      photo_type VARCHAR NOT NULL CHECK (photo_type IN ('competitor', 'our_product')),
      store_id UUID REFERENCES public.stores(id),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
      created_by UUID REFERENCES auth.users(id)
    );

    ALTER TABLE public.competitor_comparison_photos ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Acesso total competitor_comparison_photos"
      ON public.competitor_comparison_photos
      FOR ALL
      USING (true);
  END IF;
END $$;