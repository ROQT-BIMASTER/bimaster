-- Tabela para registro de saldos bancários diários
CREATE TABLE public.trade_bank_daily_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID REFERENCES public.trade_bank_accounts(id) ON DELETE CASCADE,
  balance_date DATE NOT NULL,
  opening_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_credits DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_debits DECIMAL(15,2) NOT NULL DEFAULT 0,
  closing_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Garantir unicidade de conta + data
  UNIQUE(bank_account_id, balance_date)
);

-- Enable RLS
ALTER TABLE public.trade_bank_daily_balances ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Allow authenticated users to view bank daily balances"
ON public.trade_bank_daily_balances FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert bank daily balances"
ON public.trade_bank_daily_balances FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update bank daily balances"
ON public.trade_bank_daily_balances FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete bank daily balances"
ON public.trade_bank_daily_balances FOR DELETE
TO authenticated
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_trade_bank_daily_balances_updated_at
BEFORE UPDATE ON public.trade_bank_daily_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_bank_daily_balances_date ON public.trade_bank_daily_balances(balance_date);
CREATE INDEX idx_bank_daily_balances_account_date ON public.trade_bank_daily_balances(bank_account_id, balance_date DESC);

-- Comentários
COMMENT ON TABLE public.trade_bank_daily_balances IS 'Registro diário de saldos bancários por conta';
COMMENT ON COLUMN public.trade_bank_daily_balances.opening_balance IS 'Saldo inicial do dia';
COMMENT ON COLUMN public.trade_bank_daily_balances.closing_balance IS 'Saldo final do dia';