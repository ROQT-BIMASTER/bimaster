-- Verificar e criar tabela se não existir
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'measurement_guide_photos') THEN
    CREATE TABLE public.measurement_guide_photos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      photo_url TEXT NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      order_index INTEGER NOT NULL DEFAULT 1,
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
    );
  END IF;
END $$;

-- Habilitar RLS
ALTER TABLE public.measurement_guide_photos ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Usuários autenticados podem ver guia de medição" ON public.measurement_guide_photos;
DROP POLICY IF EXISTS "Apenas admins e supervisores gerenciam guia" ON public.measurement_guide_photos;

-- Criar políticas
CREATE POLICY "Usuários autenticados podem ver guia de medição"
ON public.measurement_guide_photos
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Apenas admins e supervisores gerenciam guia"
ON public.measurement_guide_photos
FOR ALL
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_measurement_guide_order ON public.measurement_guide_photos(order_index);
CREATE INDEX IF NOT EXISTS idx_measurement_guide_created ON public.measurement_guide_photos(created_at);

-- Comentário
COMMENT ON TABLE public.measurement_guide_photos IS 'Fotos instrutivas do guia de como medir prateleiras corretamente';
