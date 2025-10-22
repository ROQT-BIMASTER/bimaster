-- Adicionar campos centro_custo e departamento à tabela trade_chart_of_accounts
ALTER TABLE public.trade_chart_of_accounts
ADD COLUMN IF NOT EXISTS centro_custo VARCHAR(100),
ADD COLUMN IF NOT EXISTS departamento VARCHAR(100);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_trade_chart_accounts_centro_custo 
ON public.trade_chart_of_accounts(centro_custo);

CREATE INDEX IF NOT EXISTS idx_trade_chart_accounts_departamento 
ON public.trade_chart_of_accounts(departamento);