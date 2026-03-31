
-- Trocar unique constraint de code para (code, versao)
ALTER TABLE public.trade_chart_of_accounts DROP CONSTRAINT IF EXISTS trade_chart_of_accounts_code_key;
DROP INDEX IF EXISTS idx_chart_accounts_code;

CREATE UNIQUE INDEX trade_chart_of_accounts_code_versao_key 
ON public.trade_chart_of_accounts (code, versao);

CREATE INDEX idx_chart_accounts_code_active 
ON public.trade_chart_of_accounts (code) WHERE is_active = true;
