-- Tabela de investimentos por PDV
CREATE TABLE public.trade_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  investment_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT,
  payment_method VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Tabela de plano de contas
CREATE TABLE public.trade_chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  parent_account_id UUID REFERENCES public.trade_chart_of_accounts(id) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Tabela de verbas (budgets)
CREATE TABLE public.trade_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  allocated_amount NUMERIC(12, 2) DEFAULT 0,
  spent_amount NUMERIC(12, 2) DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  account_id UUID REFERENCES public.trade_chart_of_accounts(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active',
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Tabela de lançamentos financeiros
CREATE TABLE public.trade_financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL,
  account_id UUID REFERENCES public.trade_chart_of_accounts(id) ON DELETE RESTRICT NOT NULL,
  budget_id UUID REFERENCES public.trade_budgets(id) ON DELETE SET NULL,
  investment_id UUID REFERENCES public.trade_investments(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  entry_type VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  reference_number VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_trade_investments_store ON public.trade_investments(store_id);
CREATE INDEX idx_trade_investments_date ON public.trade_investments(investment_date);
CREATE INDEX idx_trade_financial_entries_date ON public.trade_financial_entries(entry_date);
CREATE INDEX idx_trade_financial_entries_account ON public.trade_financial_entries(account_id);
CREATE INDEX idx_trade_financial_entries_budget ON public.trade_financial_entries(budget_id);
CREATE INDEX idx_trade_budgets_period ON public.trade_budgets(period_start, period_end);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_trade_investments_updated_at
  BEFORE UPDATE ON public.trade_investments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trade_chart_of_accounts_updated_at
  BEFORE UPDATE ON public.trade_chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trade_budgets_updated_at
  BEFORE UPDATE ON public.trade_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trade_financial_entries_updated_at
  BEFORE UPDATE ON public.trade_financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.trade_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_financial_entries ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso total
CREATE POLICY "Acesso total trade_investments" ON public.trade_investments FOR ALL USING (true);
CREATE POLICY "Acesso total trade_chart_of_accounts" ON public.trade_chart_of_accounts FOR ALL USING (true);
CREATE POLICY "Acesso total trade_budgets" ON public.trade_budgets FOR ALL USING (true);
CREATE POLICY "Acesso total trade_financial_entries" ON public.trade_financial_entries FOR ALL USING (true);

-- Inserir contas padrão no plano de contas
INSERT INTO public.trade_chart_of_accounts (code, name, account_type, description) VALUES
('1000', 'Investimentos em Trade', 'expense', 'Conta principal de investimentos em Trade Marketing'),
('1100', 'Material POP', 'expense', 'Materiais de ponto de venda'),
('1200', 'Promotores', 'expense', 'Custos com promotores e demonstradores'),
('1300', 'Brindes e Prêmios', 'expense', 'Brindes, prêmios e amostras'),
('1400', 'Eventos', 'expense', 'Eventos e ativações'),
('1500', 'Logística', 'expense', 'Custos de logística e distribuição'),
('2000', 'Verbas Comerciais', 'budget', 'Verbas disponibilizadas para trade'),
('2100', 'Verba Nacional', 'budget', 'Verba de abrangência nacional'),
('2200', 'Verba Regional', 'budget', 'Verba de abrangência regional');