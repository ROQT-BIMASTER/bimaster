-- Adicionar colunas para nome e email do solicitante
ALTER TABLE public.trade_budgets
ADD COLUMN IF NOT EXISTS requester_name TEXT,
ADD COLUMN IF NOT EXISTS requester_email TEXT;

-- Criar índice para busca por email
CREATE INDEX IF NOT EXISTS idx_trade_budgets_requester_email ON public.trade_budgets(requester_email);