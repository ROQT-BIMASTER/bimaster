
-- 1. Marketing/Trade → despesas_variaveis
UPDATE trade_chart_of_accounts SET categoria_dre = 'despesas_variaveis' WHERE code LIKE '3.3%';
UPDATE trade_chart_of_accounts SET categoria_dre = 'despesas_variaveis' WHERE code LIKE '2.6%';

-- 2. Financial result → resultado_financeiro
UPDATE trade_chart_of_accounts SET categoria_dre = 'resultado_financeiro' WHERE code IN ('3.4', '3.4.1', '3.4.2');
UPDATE trade_chart_of_accounts SET categoria_dre = 'resultado_financeiro' WHERE code IN ('4.3.3', '4.3.5', '4.3.6');

-- 3. Non-operational → resultado_nao_operacional
UPDATE trade_chart_of_accounts SET categoria_dre = 'resultado_nao_operacional' WHERE code IN ('4.1', '4.1.1', '4.1.2');

-- 4. Devoluções → deducoes
UPDATE trade_chart_of_accounts SET categoria_dre = 'deducoes' WHERE code = '2.1.2';

-- 5. Patrimonial accounts → NULL (out of DRE)
UPDATE trade_chart_of_accounts SET categoria_dre = NULL WHERE code LIKE '4.2%';
UPDATE trade_chart_of_accounts SET categoria_dre = NULL WHERE code IN ('4.3', '4.3.1', '4.3.2', '4.3.4', '4.3.7', '4.3.8', '4.3.9');
UPDATE trade_chart_of_accounts SET categoria_dre = NULL WHERE code LIKE '4.4%';
UPDATE trade_chart_of_accounts SET categoria_dre = NULL WHERE code = '4';
