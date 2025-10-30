-- Adicionar role promotora ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'promotora';

-- Criar tabela para configuração de marcas próprias
CREATE TABLE IF NOT EXISTS public.our_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name VARCHAR(200) NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_primary BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.our_brands ENABLE ROW LEVEL SECURITY;

-- Políticas para our_brands
CREATE POLICY "Admins e supervisores gerenciam marcas próprias"
  ON public.our_brands FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Usuários autenticados podem ver marcas próprias"
  ON public.our_brands FOR SELECT
  USING (active = true);

-- Criar tabela para medições de prateleiras
CREATE TABLE IF NOT EXISTS public.shelf_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  measurement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shelf_section VARCHAR(100),
  total_shelf_width_cm NUMERIC(10,2) NOT NULL,
  total_shelf_height_cm NUMERIC(10,2),
  total_facings INTEGER,
  our_brands_width_cm NUMERIC(10,2),
  our_brands_facings INTEGER,
  competitors_width_cm NUMERIC(10,2),
  competitors_facings INTEGER,
  shelf_share_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_shelf_width_cm > 0 THEN (our_brands_width_cm / total_shelf_width_cm) * 100
      ELSE 0
    END
  ) STORED,
  facing_share_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_facings > 0 THEN (our_brands_facings::NUMERIC / total_facings) * 100
      ELSE 0
    END
  ) STORED,
  photo_ids TEXT[],
  observations TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.shelf_measurements ENABLE ROW LEVEL SECURITY;

-- Políticas para shelf_measurements
CREATE POLICY "Usuários podem criar medições"
  ON public.shelf_measurements FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Usuários podem ver próprias medições"
  ON public.shelf_measurements FOR SELECT
  USING (
    created_by = auth.uid() 
    OR is_admin_or_supervisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = shelf_measurements.store_id
      AND s.created_by = auth.uid()
    )
  );

CREATE POLICY "Criadores podem atualizar suas medições"
  ON public.shelf_measurements FOR UPDATE
  USING (created_by = auth.uid() OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins podem deletar medições"
  ON public.shelf_measurements FOR DELETE
  USING (is_admin_or_supervisor(auth.uid()));

-- Criar tabela para itens de sell out (múltiplos produtos por pedido)
CREATE TABLE IF NOT EXISTS public.store_sellout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sellout_batch_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  product_id UUID NOT NULL REFERENCES public.store_products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2),
  total_amount NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.store_sellout_items ENABLE ROW LEVEL SECURITY;

-- Políticas para store_sellout_items
CREATE POLICY "Usuários podem criar itens de sell out"
  ON public.store_sellout_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Usuários podem ver itens de sell out"
  ON public.store_sellout_items FOR SELECT
  USING (
    is_admin_or_supervisor(auth.uid())
    OR EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = store_sellout_items.store_id
      AND (
        s.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM visits v
          WHERE v.store_id = s.id
          AND v.user_id = auth.uid()
        )
      )
    )
  );

-- Adicionar campo batch_id à tabela store_sellouts para agrupar vendas
ALTER TABLE public.store_sellouts 
  ADD COLUMN IF NOT EXISTS batch_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(50);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_shelf_measurements_store ON public.shelf_measurements(store_id);
CREATE INDEX IF NOT EXISTS idx_shelf_measurements_date ON public.shelf_measurements(measurement_date);
CREATE INDEX IF NOT EXISTS idx_sellout_items_batch ON public.store_sellout_items(sellout_batch_id);
CREATE INDEX IF NOT EXISTS idx_sellout_items_product ON public.store_sellout_items(product_id);
CREATE INDEX IF NOT EXISTS idx_our_brands_active ON public.our_brands(active) WHERE active = true;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_our_brands_updated_at
  BEFORE UPDATE ON public.our_brands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shelf_measurements_updated_at
  BEFORE UPDATE ON public.shelf_measurements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.our_brands IS 'Marcas próprias da empresa para análise de IA';
COMMENT ON TABLE public.shelf_measurements IS 'Medições de espaço em prateleiras (shelf share)';
COMMENT ON TABLE public.store_sellout_items IS 'Itens individuais de pedidos sell out (múltiplos produtos)';
COMMENT ON COLUMN public.shelf_measurements.shelf_share_percentage IS 'Percentual de espaço ocupado pelas nossas marcas (calculado automaticamente)';
COMMENT ON COLUMN public.shelf_measurements.facing_share_percentage IS 'Percentual de frentes ocupadas pelas nossas marcas (calculado automaticamente)';