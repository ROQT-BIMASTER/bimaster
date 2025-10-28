-- Adicionar campos de estoque e sell out nas tabelas de trade marketing

-- Criar tabela de produtos para lojistas
CREATE TABLE IF NOT EXISTS public.store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_code TEXT,
  current_stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER,
  unit_price DECIMAL(10,2),
  category TEXT,
  brand TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de sell out (saídas de produtos)
CREATE TABLE IF NOT EXISTS public.store_sellouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  unit_price DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Criar tabela de movimentações de estoque
CREATE TABLE IF NOT EXISTS public.store_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('entrada', 'saida', 'ajuste', 'devolucao')),
  quantity INTEGER NOT NULL,
  previous_stock INTEGER,
  new_stock INTEGER,
  reason TEXT,
  notes TEXT,
  movement_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_store_products_store ON public.store_products(store_id);
CREATE INDEX IF NOT EXISTS idx_store_products_code ON public.store_products(product_code);
CREATE INDEX IF NOT EXISTS idx_store_sellouts_store ON public.store_sellouts(store_id);
CREATE INDEX IF NOT EXISTS idx_store_sellouts_product ON public.store_sellouts(product_id);
CREATE INDEX IF NOT EXISTS idx_store_sellouts_date ON public.store_sellouts(sale_date);
CREATE INDEX IF NOT EXISTS idx_store_stock_movements_store ON public.store_stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_store_stock_movements_product ON public.store_stock_movements(product_id);

-- Habilitar RLS
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_sellouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_stock_movements ENABLE ROW LEVEL SECURITY;

-- Policies para store_products (todos autenticados podem ver, admins gerenciam)
CREATE POLICY "Usuários autenticados podem ver produtos"
  ON public.store_products FOR SELECT
  USING (true);

CREATE POLICY "Admins e supervisores gerenciam produtos"
  ON public.store_products FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- Policies para store_sellouts  
CREATE POLICY "Usuários autenticados podem ver sell outs"
  ON public.store_sellouts FOR SELECT
  USING (true);

CREATE POLICY "Usuários podem inserir sell outs"
  ON public.store_sellouts FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins e supervisores gerenciam sell outs"
  ON public.store_sellouts FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- Policies para store_stock_movements
CREATE POLICY "Usuários autenticados podem ver movimentações"
  ON public.store_stock_movements FOR SELECT
  USING (true);

CREATE POLICY "Usuários podem inserir movimentações"
  ON public.store_stock_movements FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins e supervisores gerenciam movimentações"
  ON public.store_stock_movements FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- Trigger para atualizar updated_at em store_products
CREATE OR REPLACE FUNCTION update_store_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_store_products_updated_at_trigger
  BEFORE UPDATE ON public.store_products
  FOR EACH ROW
  EXECUTE FUNCTION update_store_products_updated_at();

-- Função para atualizar estoque após sell out
CREATE OR REPLACE FUNCTION update_stock_after_sellout()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar o estoque do produto
  UPDATE public.store_products
  SET current_stock = current_stock - NEW.quantity
  WHERE id = NEW.product_id;
  
  -- Registrar movimentação de estoque
  INSERT INTO public.store_stock_movements (
    store_id,
    product_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reason,
    created_by
  )
  SELECT
    NEW.store_id,
    NEW.product_id,
    'saida',
    NEW.quantity,
    sp.current_stock + NEW.quantity,
    sp.current_stock,
    'Sell out registrado',
    NEW.created_by
  FROM public.store_products sp
  WHERE sp.id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_stock_after_sellout
  AFTER INSERT ON public.store_sellouts
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_after_sellout();