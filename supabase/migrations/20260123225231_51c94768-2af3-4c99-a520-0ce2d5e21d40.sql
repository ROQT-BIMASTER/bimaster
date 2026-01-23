-- Create table for campaign launches (executions per client/PDV)
CREATE TABLE public.trade_campaign_lancamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.trade_campaigns(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.prospects(id),
  store_id UUID REFERENCES public.stores(id),
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_pedido NUMERIC DEFAULT 0,
  tipo_brinde VARCHAR(255),
  acoes_manuais TEXT,
  sell_out_anterior NUMERIC DEFAULT 0,
  sell_out_atual NUMERIC DEFAULT 0,
  unon_anterior NUMERIC DEFAULT 0,
  unon_atual NUMERIC DEFAULT 0,
  crescimento_percentual NUMERIC GENERATED ALWAYS AS (
    CASE WHEN sell_out_anterior > 0 
    THEN ((sell_out_atual - sell_out_anterior) / sell_out_anterior) * 100 
    ELSE 0 END
  ) STORED,
  roi_percentual NUMERIC,
  roi_valor NUMERIC,
  evidencias JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  validation_notes TEXT,
  validated_by UUID,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trade_campaign_lancamentos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view all launches"
  ON public.trade_campaign_lancamentos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert launches"
  ON public.trade_campaign_lancamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update launches"
  ON public.trade_campaign_lancamentos
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete launches"
  ON public.trade_campaign_lancamentos
  FOR DELETE
  TO authenticated
  USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_trade_campaign_lancamentos_updated_at
  BEFORE UPDATE ON public.trade_campaign_lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_trade_campaign_lancamentos_campaign_id ON public.trade_campaign_lancamentos(campaign_id);
CREATE INDEX idx_trade_campaign_lancamentos_customer_id ON public.trade_campaign_lancamentos(customer_id);
CREATE INDEX idx_trade_campaign_lancamentos_status ON public.trade_campaign_lancamentos(status);