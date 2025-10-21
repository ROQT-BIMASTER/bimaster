-- Criar tabela de vendas
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_code VARCHAR(100) NOT NULL UNIQUE,
  sale_date DATE NOT NULL,
  store_id UUID REFERENCES public.stores(id),
  prospect_id UUID REFERENCES public.prospects(id),
  campaign_id UUID REFERENCES public.trade_campaigns(id),
  salesperson_id UUID REFERENCES auth.users(id),
  
  -- Valores
  total_value NUMERIC(15,2) NOT NULL,
  discount_value NUMERIC(15,2) DEFAULT 0,
  net_value NUMERIC(15,2) NOT NULL,
  
  -- Detalhes
  payment_method VARCHAR(50),
  payment_terms TEXT,
  delivery_date DATE,
  
  -- Relacionamento com prospects
  converted_from_prospect BOOLEAN DEFAULT false,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Observações
  notes TEXT,
  
  -- Auditoria
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Aprovação
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP
);

-- Criar tabela de itens de venda
CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  
  -- Produto (assumindo que temos uma tabela de produtos)
  product_name VARCHAR(255) NOT NULL,
  product_code VARCHAR(100),
  
  -- Quantidades e valores
  quantity NUMERIC(15,2) NOT NULL,
  unit_price NUMERIC(15,2) NOT NULL,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  total_value NUMERIC(15,2) NOT NULL,
  
  -- Detalhes
  unit_of_measure VARCHAR(20) DEFAULT 'UN',
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_sales_store ON public.sales(store_id);
CREATE INDEX IF NOT EXISTS idx_sales_prospect ON public.sales(prospect_id);
CREATE INDEX IF NOT EXISTS idx_sales_campaign ON public.sales(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sales_salesperson ON public.sales(salesperson_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sales_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies para sales
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver suas próprias vendas
CREATE POLICY "Usuários podem ver próprias vendas"
  ON public.sales FOR SELECT
  USING (
    salesperson_id = auth.uid() OR 
    created_by = auth.uid() OR 
    is_admin_or_supervisor(auth.uid())
  );

-- Usuários podem criar vendas
CREATE POLICY "Usuários podem criar vendas"
  ON public.sales FOR INSERT
  WITH CHECK (
    salesperson_id = auth.uid() OR 
    created_by = auth.uid()
  );

-- Usuários podem atualizar suas próprias vendas
CREATE POLICY "Usuários podem atualizar próprias vendas"
  ON public.sales FOR UPDATE
  USING (
    salesperson_id = auth.uid() OR 
    created_by = auth.uid() OR 
    is_admin_or_supervisor(auth.uid())
  );

-- Apenas admins podem deletar vendas
CREATE POLICY "Apenas admins podem deletar vendas"
  ON public.sales FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies para sale_items
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver itens de suas vendas
CREATE POLICY "Usuários podem ver itens de suas vendas"
  ON public.sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE sales.id = sale_items.sale_id
      AND (
        sales.salesperson_id = auth.uid() OR 
        sales.created_by = auth.uid() OR 
        is_admin_or_supervisor(auth.uid())
      )
    )
  );

-- Usuários podem criar itens para suas vendas
CREATE POLICY "Usuários podem criar itens de venda"
  ON public.sale_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE sales.id = sale_items.sale_id
      AND (sales.salesperson_id = auth.uid() OR sales.created_by = auth.uid())
    )
  );

-- Usuários podem atualizar itens de suas vendas
CREATE POLICY "Usuários podem atualizar itens de suas vendas"
  ON public.sale_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sales
      WHERE sales.id = sale_items.sale_id
      AND (
        sales.salesperson_id = auth.uid() OR 
        sales.created_by = auth.uid() OR 
        is_admin_or_supervisor(auth.uid())
      )
    )
  );

-- Apenas admins podem deletar itens
CREATE POLICY "Apenas admins podem deletar itens de venda"
  ON public.sale_items FOR DELETE
  USING (has_role(auth.uid(), 'admin'));