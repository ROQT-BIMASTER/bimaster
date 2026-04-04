
-- 1. Transform 3.2.1.1 from group to analytical "Salários"
UPDATE trade_chart_of_accounts 
SET name = 'Salários', is_group = false, permite_lancamento = true 
WHERE id = 'e27530b9-502d-48c2-a726-d0ef30c035e3';

-- 2. Reparent 3.2.1.1.2 → 3.2.1.4 Ajuda de Custo
UPDATE trade_chart_of_accounts 
SET code = '3.2.1.4', parent_account_id = '12839e27-d99f-47c0-a52d-343dedd4547e', nivel = 4
WHERE id = 'b6d03dee-b052-4007-919b-cf37493b6948';

-- 3. Create new accounts
INSERT INTO trade_chart_of_accounts (code, name, account_type, categoria_dre, nivel, natureza, is_group, permite_lancamento, parent_account_id, is_active)
VALUES
  ('3.2.1.2', 'Horas Extras', 'expense', 'despesas_fixas', 4, 'D', false, true, '12839e27-d99f-47c0-a52d-343dedd4547e', true),
  ('3.2.1.3', 'Adiantamentos', 'expense', 'despesas_fixas', 4, 'D', false, true, '12839e27-d99f-47c0-a52d-343dedd4547e', true);

-- 4. Rename 3.2.4
UPDATE trade_chart_of_accounts SET name = 'Pensão e Descontos' WHERE id = '906addce-1990-4757-881b-8851ab4af1d6';

-- 5. Fix typo
UPDATE trade_chart_of_accounts SET name = 'Expositores' WHERE id = '5924c243-4661-4983-943a-888f971ad3ef';

-- 6. categoria_dre for Group 4
UPDATE trade_chart_of_accounts SET categoria_dre = 'receita_bruta' WHERE code = '4.1.1';
UPDATE trade_chart_of_accounts SET categoria_dre = 'despesas_fixas' WHERE code = '4.1.2';
UPDATE trade_chart_of_accounts SET categoria_dre = 'despesas_fixas' WHERE code IN ('4.2.1','4.2.2','4.2.3','4.2.4','4.2.5','4.2.6','4.2.7');
UPDATE trade_chart_of_accounts SET categoria_dre = 'despesas_fixas' WHERE code IN ('4.3.1','4.3.2','4.3.3','4.3.4','4.3.5','4.3.6','4.3.7','4.3.8','4.3.9');
UPDATE trade_chart_of_accounts SET categoria_dre = 'despesas_fixas' WHERE code IN ('4.4.1','4.4.2');
UPDATE trade_chart_of_accounts SET categoria_dre = 'despesas_fixas' WHERE code IN ('4','4.1','4.2','4.3','4.4');
