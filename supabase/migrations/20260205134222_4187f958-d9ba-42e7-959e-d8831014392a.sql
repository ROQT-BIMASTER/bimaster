-- Adicionar colunas empresa_id e empresa_nome nas tabelas

-- Eventos corporativos
ALTER TABLE corporate_events 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

-- Despesas de eventos
ALTER TABLE corporate_event_expenses 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

-- Lançamentos Trade
ALTER TABLE trade_financial_entries 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

-- Orçamentos Trade
ALTER TABLE trade_budgets 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

-- Verbas de Departamento
ALTER TABLE department_budgets 
ADD COLUMN IF NOT EXISTS empresa_id INTEGER REFERENCES empresas(id),
ADD COLUMN IF NOT EXISTS empresa_nome VARCHAR(255);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_corporate_events_empresa ON corporate_events(empresa_id);
CREATE INDEX IF NOT EXISTS idx_corporate_event_expenses_empresa ON corporate_event_expenses(empresa_id);
CREATE INDEX IF NOT EXISTS idx_trade_financial_entries_empresa ON trade_financial_entries(empresa_id);
CREATE INDEX IF NOT EXISTS idx_trade_budgets_empresa ON trade_budgets(empresa_id);
CREATE INDEX IF NOT EXISTS idx_department_budgets_empresa ON department_budgets(empresa_id);