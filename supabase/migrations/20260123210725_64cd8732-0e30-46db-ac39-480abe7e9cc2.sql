-- Remover coluna codigo_dre_gerencial do plano de contas
ALTER TABLE trade_chart_of_accounts DROP COLUMN IF EXISTS codigo_dre_gerencial;