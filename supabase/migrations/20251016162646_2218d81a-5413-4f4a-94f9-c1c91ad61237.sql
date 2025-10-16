-- ==============================================================
-- MELHORIAS DE SEGURANÇA: MÓDULO FINANCEIRO TRADE MARKETING
-- ==============================================================

-- 1. Adicionar políticas DELETE para trade_investments
-- Apenas admins e o criador podem deletar investimentos
CREATE POLICY "Criadores e admins podem deletar investimentos"
ON trade_investments FOR DELETE
USING (
  created_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

-- 2. Melhorar política de UPDATE para trade_investments
-- Atualmente apenas admins podem atualizar, vamos permitir que criadores também atualizem
DROP POLICY IF EXISTS "Apenas admins podem gerenciar investimentos trade" ON trade_investments;

CREATE POLICY "Criadores e admins podem atualizar investimentos"
ON trade_investments FOR UPDATE
USING (
  created_by = auth.uid() OR 
  is_admin_or_supervisor(auth.uid())
);

-- 3. Adicionar política de INSERT para trade_investments (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'trade_investments' 
    AND policyname LIKE '%INSERT%'
  ) THEN
    EXECUTE 'CREATE POLICY "Usuários autenticados podem criar investimentos"
    ON trade_investments FOR INSERT
    WITH CHECK (created_by = auth.uid())';
  END IF;
END $$;

-- 4. Adicionar políticas DELETE para trade_budgets
-- Apenas admins podem deletar verbas
CREATE POLICY "Apenas admins podem deletar verbas"
ON trade_budgets FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Adicionar políticas DELETE para trade_chart_of_accounts
-- Apenas admins podem deletar contas contábeis
CREATE POLICY "Apenas admins podem deletar plano de contas"
ON trade_chart_of_accounts FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. Adicionar políticas DELETE para trade_financial_entries
-- Apenas admins podem deletar lançamentos financeiros
CREATE POLICY "Apenas admins podem deletar lançamentos financeiros"
ON trade_financial_entries FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. Adicionar constraints de validação para valores
-- Garantir que valores sejam positivos e razoáveis
ALTER TABLE trade_budgets
ADD CONSTRAINT check_budget_total_amount_positive 
CHECK (total_amount > 0 AND total_amount <= 100000000);

ALTER TABLE trade_budgets
ADD CONSTRAINT check_budget_spent_amount_valid 
CHECK (spent_amount >= 0 AND spent_amount <= total_amount);

ALTER TABLE trade_budgets
ADD CONSTRAINT check_budget_allocated_amount_valid 
CHECK (allocated_amount >= 0 AND allocated_amount <= total_amount);

ALTER TABLE trade_investments
ADD CONSTRAINT check_investment_amount_positive 
CHECK (amount > 0 AND amount <= 1000000);

ALTER TABLE trade_financial_entries
ADD CONSTRAINT check_financial_entry_amount_positive 
CHECK (amount > 0 AND amount <= 10000000);

-- 8. Adicionar índices para performance em queries financeiras
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

-- 9. Adicionar trigger para validar período de verba
CREATE OR REPLACE FUNCTION validate_budget_period()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.period_end <= NEW.period_start THEN
    RAISE EXCEPTION 'Data de fim deve ser posterior à data de início';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_budget_period
BEFORE INSERT OR UPDATE ON trade_budgets
FOR EACH ROW
EXECUTE FUNCTION validate_budget_period();

-- 10. Adicionar trigger para validar datas futuras em investimentos
CREATE OR REPLACE FUNCTION validate_investment_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.investment_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data do investimento não pode ser futura';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_investment_date
BEFORE INSERT OR UPDATE ON trade_investments
FOR EACH ROW
EXECUTE FUNCTION validate_investment_date();