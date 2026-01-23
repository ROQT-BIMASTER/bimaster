-- Add lancamento_id FK to related tables for per-launch tracking

-- Add lancamento_id to trade_campaign_products
ALTER TABLE public.trade_campaign_products 
ADD COLUMN lancamento_id UUID REFERENCES public.trade_campaign_lancamentos(id) ON DELETE CASCADE;

-- Add lancamento_id to trade_campaign_expenses
ALTER TABLE public.trade_campaign_expenses 
ADD COLUMN lancamento_id UUID REFERENCES public.trade_campaign_lancamentos(id) ON DELETE CASCADE;

-- Add lancamento_id to trade_campaign_sellout_entries
ALTER TABLE public.trade_campaign_sellout_entries 
ADD COLUMN lancamento_id UUID REFERENCES public.trade_campaign_lancamentos(id) ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX idx_trade_campaign_products_lancamento_id ON public.trade_campaign_products(lancamento_id);
CREATE INDEX idx_trade_campaign_expenses_lancamento_id ON public.trade_campaign_expenses(lancamento_id);
CREATE INDEX idx_trade_campaign_sellout_entries_lancamento_id ON public.trade_campaign_sellout_entries(lancamento_id);