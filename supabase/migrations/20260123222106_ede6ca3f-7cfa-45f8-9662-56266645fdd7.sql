-- Criar tabela para múltiplos pedidos por campanha
CREATE TABLE IF NOT EXISTS trade_campaign_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES trade_campaigns(id) ON DELETE CASCADE,
  numero_pedido VARCHAR(50) NOT NULL,
  numero_nf VARCHAR(50),
  valor_pedido NUMERIC(15,2) DEFAULT 0,
  data_pedido DATE,
  data_nf DATE,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_campaign_orders_campaign ON trade_campaign_orders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_orders_numero ON trade_campaign_orders(numero_pedido);

-- Habilitar RLS
ALTER TABLE trade_campaign_orders ENABLE ROW LEVEL SECURITY;

-- Políticas para acesso autenticado
CREATE POLICY "trade_campaign_orders_select" ON trade_campaign_orders 
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "trade_campaign_orders_insert" ON trade_campaign_orders 
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "trade_campaign_orders_update" ON trade_campaign_orders 
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "trade_campaign_orders_delete" ON trade_campaign_orders 
  FOR DELETE TO authenticated USING (true);

-- Comentários
COMMENT ON TABLE trade_campaign_orders IS 'Pedidos vinculados a campanhas de trade marketing';
COMMENT ON COLUMN trade_campaign_orders.numero_pedido IS 'Número do pedido';
COMMENT ON COLUMN trade_campaign_orders.numero_nf IS 'Número da Nota Fiscal';
COMMENT ON COLUMN trade_campaign_orders.valor_pedido IS 'Valor do pedido';