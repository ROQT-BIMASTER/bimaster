-- ==============================================================
-- FINALIZAÇÃO: MÓDULO FINANCEIRO TRADE MARKETING - SEGURANÇA
-- ==============================================================

-- 1. Remover políticas antigas e adicionar novas para trade_investments
DROP POLICY IF EXISTS "Apenas admins podem gerenciar investimentos trade" ON trade_investments;
DROP POLICY IF EXISTS "Criadores e admins podem deletar investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Criadores e admins podem atualizar investimentos" ON trade_investments;
DROP POLICY IF EXISTS "Usuários autenticados podem criar investimentos" ON trade_investments;

CREATE POLICY "Criadores e admins podem gerenciar investimentos"
ON trade_investments FOR ALL
USING (
  created_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

-- 2. Constraints de validação com verificação de existência
DO $$ 
BEGIN
  -- trade_budgets constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_budget_total_amount_positive') THEN
    ALTER TABLE trade_budgets ADD CONSTRAINT check_budget_total_amount_positive 
    CHECK (total_amount > 0 AND total_amount <= 100000000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_budget_spent_amount_valid') THEN
    ALTER TABLE trade_budgets ADD CONSTRAINT check_budget_spent_amount_valid 
    CHECK (spent_amount >= 0 AND spent_amount <= total_amount);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_budget_allocated_amount_valid') THEN
    ALTER TABLE trade_budgets ADD CONSTRAINT check_budget_allocated_amount_valid 
    CHECK (allocated_amount >= 0 AND allocated_amount <= total_amount);
  END IF;

  -- trade_investments constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_investment_amount_positive') THEN
    ALTER TABLE trade_investments ADD CONSTRAINT check_investment_amount_positive 
    CHECK (amount > 0 AND amount <= 1000000);
  END IF;

  -- trade_financial_entries constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_financial_entry_amount_positive') THEN
    ALTER TABLE trade_financial_entries ADD CONSTRAINT check_financial_entry_amount_positive 
    CHECK (amount > 0 AND amount <= 10000000);
  END IF;
END $$;

-- 3. Índices de performance
CREATE INDEX IF NOT EXISTS idx_trade_investments_created_by 
ON trade_investments(created_by);

CREATE INDEX IF NOT EXISTS idx_trade_investments_store_date 
ON trade_investments(store_id, investment_date DESC);

CREATE INDEX IF NOT EXISTS idx_trade_investments_category 
ON trade_investments(category);

CREATE INDEX IF NOT EXISTS idx_trade_budgets_period 
ON trade_budgets(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_trade_budgets_status 
ON trade_budgets(status) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_trade_financial_entries_date 
ON trade_financial_entries(entry_date DESC);

CREATE INDEX IF NOT EXISTS idx_trade_financial_entries_account 
ON trade_financial_entries(account_id, entry_date DESC);

-- 4. Recriar triggers com verificação
DROP TRIGGER IF EXISTS trigger_validate_budget_period ON trade_budgets;
DROP TRIGGER IF EXISTS trigger_validate_investment_date ON trade_investments;

CREATE TRIGGER trigger_validate_budget_period
BEFORE INSERT OR UPDATE ON trade_budgets
FOR EACH ROW
EXECUTE FUNCTION validate_budget_period();

CREATE TRIGGER trigger_validate_investment_date
BEFORE INSERT OR UPDATE ON trade_investments
FOR EACH ROW
EXECUTE FUNCTION validate_investment_date();