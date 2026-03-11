
-- Investimentos corporativos
CREATE TABLE public.pluggy_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  pluggy_investment_id TEXT UNIQUE NOT NULL,
  name TEXT,
  type TEXT,
  subtype TEXT,
  balance NUMERIC(15,2) DEFAULT 0,
  currency_code TEXT DEFAULT 'BRL',
  annual_rate NUMERIC(8,4),
  status TEXT,
  due_date DATE,
  issuer TEXT,
  issue_date DATE,
  metadata JSONB DEFAULT '{}',
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transações de investimento
CREATE TABLE public.pluggy_investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID REFERENCES public.pluggy_investments(id) ON DELETE CASCADE,
  pluggy_transaction_id TEXT UNIQUE NOT NULL,
  type TEXT,
  description TEXT,
  amount NUMERIC(15,2),
  quantity NUMERIC(15,6),
  value NUMERIC(15,2),
  date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Identidade do titular
CREATE TABLE public.pluggy_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  document TEXT,
  document_type TEXT,
  tax_number TEXT,
  birth_date DATE,
  addresses JSONB DEFAULT '[]',
  emails JSONB DEFAULT '[]',
  phones JSONB DEFAULT '[]',
  raw_data JSONB DEFAULT '{}',
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Empréstimos
CREATE TABLE public.pluggy_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  pluggy_account_id TEXT,
  name TEXT,
  loan_amount NUMERIC(15,2),
  outstanding_balance NUMERIC(15,2),
  interest_rate NUMERIC(8,4),
  installments_total INT,
  installments_paid INT,
  next_payment_date DATE,
  monthly_payment NUMERIC(15,2),
  contract_number TEXT,
  metadata JSONB DEFAULT '{}',
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Regras de categorização customizadas
CREATE TABLE public.pluggy_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pluggy_rule_id TEXT,
  description TEXT NOT NULL,
  category_id TEXT NOT NULL,
  category_name TEXT,
  conta_contabil_id UUID REFERENCES public.trade_chart_of_accounts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alertas de saldo
CREATE TABLE public.balance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  threshold NUMERIC(15,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extensão de bank_connections para cartões e empréstimos
ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'BANK',
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS available_limit NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS bill_due_date DATE,
  ADD COLUMN IF NOT EXISTS bill_amount NUMERIC(15,2);

-- Adicionar categoria Pluggy às conciliacoes_bancarias
ALTER TABLE public.conciliacoes_bancarias
  ADD COLUMN IF NOT EXISTS pluggy_category TEXT,
  ADD COLUMN IF NOT EXISTS pluggy_category_id TEXT,
  ADD COLUMN IF NOT EXISTS conta_contabil_id UUID REFERENCES public.trade_chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS payment_data JSONB;

-- RLS: pluggy_investments
ALTER TABLE public.pluggy_investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their investments" ON public.pluggy_investments
  FOR ALL TO authenticated
  USING (
    bank_connection_id IN (SELECT id FROM public.bank_connections WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bank_connection_id IN (SELECT id FROM public.bank_connections WHERE user_id = auth.uid())
  );

-- RLS: pluggy_investment_transactions
ALTER TABLE public.pluggy_investment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their investment transactions" ON public.pluggy_investment_transactions
  FOR ALL TO authenticated
  USING (
    investment_id IN (
      SELECT pi.id FROM public.pluggy_investments pi
      JOIN public.bank_connections bc ON pi.bank_connection_id = bc.id
      WHERE bc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    investment_id IN (
      SELECT pi.id FROM public.pluggy_investments pi
      JOIN public.bank_connections bc ON pi.bank_connection_id = bc.id
      WHERE bc.user_id = auth.uid()
    )
  );

-- RLS: pluggy_identities
ALTER TABLE public.pluggy_identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their identities" ON public.pluggy_identities
  FOR ALL TO authenticated
  USING (
    bank_connection_id IN (SELECT id FROM public.bank_connections WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bank_connection_id IN (SELECT id FROM public.bank_connections WHERE user_id = auth.uid())
  );

-- RLS: pluggy_loans
ALTER TABLE public.pluggy_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their loans" ON public.pluggy_loans
  FOR ALL TO authenticated
  USING (
    bank_connection_id IN (SELECT id FROM public.bank_connections WHERE user_id = auth.uid())
  )
  WITH CHECK (
    bank_connection_id IN (SELECT id FROM public.bank_connections WHERE user_id = auth.uid())
  );

-- RLS: pluggy_category_rules
ALTER TABLE public.pluggy_category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their category rules" ON public.pluggy_category_rules
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS: balance_alerts
ALTER TABLE public.balance_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their balance alerts" ON public.balance_alerts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
