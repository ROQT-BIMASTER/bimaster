-- Criar tabela de contas correntes
CREATE TABLE public.trade_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  account_number VARCHAR(50) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  agency VARCHAR(20),
  account_type VARCHAR(30) DEFAULT 'checking',
  current_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  initial_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  CONSTRAINT unique_store_account UNIQUE(store_id, account_number)
);

-- Criar tabela de transações bancárias (movimentação da conta corrente)
CREATE TABLE public.trade_bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.trade_bank_accounts(id) ON DELETE CASCADE,
  financial_entry_id UUID REFERENCES public.trade_financial_entries(id) ON DELETE SET NULL,
  investment_id UUID REFERENCES public.trade_investments(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit', 'debit')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  balance_after NUMERIC(15,2) NOT NULL,
  description TEXT NOT NULL,
  reference_number VARCHAR(50),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- Adicionar coluna bank_account_id nas tabelas existentes
ALTER TABLE public.trade_investments 
ADD COLUMN bank_account_id UUID REFERENCES public.trade_bank_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.trade_financial_entries 
ADD COLUMN bank_account_id UUID REFERENCES public.trade_bank_accounts(id) ON DELETE SET NULL;

-- Criar índices para performance
CREATE INDEX idx_bank_accounts_store ON public.trade_bank_accounts(store_id);
CREATE INDEX idx_bank_accounts_active ON public.trade_bank_accounts(is_active);
CREATE INDEX idx_bank_transactions_account ON public.trade_bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON public.trade_bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_entry ON public.trade_bank_transactions(financial_entry_id);
CREATE INDEX idx_bank_transactions_investment ON public.trade_bank_transactions(investment_id);

-- Habilitar RLS
ALTER TABLE public.trade_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_bank_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para trade_bank_accounts
CREATE POLICY "Usuários autenticados podem ver contas correntes"
  ON public.trade_bank_accounts FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins e supervisores podem gerenciar contas"
  ON public.trade_bank_accounts FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- Políticas RLS para trade_bank_transactions
CREATE POLICY "Usuários autenticados podem ver transações"
  ON public.trade_bank_transactions FOR SELECT
  USING (true);

CREATE POLICY "Apenas admins e supervisores podem gerenciar transações"
  ON public.trade_bank_transactions FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- Função para atualizar saldo da conta corrente
CREATE OR REPLACE FUNCTION public.update_bank_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance NUMERIC(15,2);
BEGIN
  -- Calcular novo saldo baseado no tipo de transação
  IF NEW.transaction_type = 'credit' THEN
    SELECT current_balance + NEW.amount INTO new_balance
    FROM trade_bank_accounts
    WHERE id = NEW.bank_account_id;
  ELSE -- debit
    SELECT current_balance - NEW.amount INTO new_balance
    FROM trade_bank_accounts
    WHERE id = NEW.bank_account_id;
  END IF;
  
  -- Atualizar saldo da conta
  UPDATE trade_bank_accounts
  SET current_balance = new_balance,
      updated_at = now()
  WHERE id = NEW.bank_account_id;
  
  -- Registrar saldo após transação
  NEW.balance_after := new_balance;
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar saldo automaticamente
CREATE TRIGGER trigger_update_bank_balance
  BEFORE INSERT ON public.trade_bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_bank_account_balance();

-- Trigger para atualizar timestamp
CREATE TRIGGER update_bank_accounts_timestamp
  BEFORE UPDATE ON public.trade_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();