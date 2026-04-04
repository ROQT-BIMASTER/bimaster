
-- ============================================================
-- 1. EMBALAGENS: 2.2 vira grupo + 4 sub-contas
-- ============================================================
UPDATE trade_chart_of_accounts 
SET is_group = true, permite_lancamento = false
WHERE id = '226587b9-2384-449f-9c17-1d3a6eef120b'; -- 2.2

INSERT INTO trade_chart_of_accounts (code, name, description, account_type, categoria_dre, nivel, natureza, is_group, permite_lancamento, parent_account_id, centro_custo, departamento, is_active)
VALUES
  ('2.2.1', 'Embalagem Primária', 'Caixas, sacos, sacolas, envelopes', 'expense', 'custo_vendas', 3, 'D', false, true, '226587b9-2384-449f-9c17-1d3a6eef120b', 'CC-LOG', 'Logística', true),
  ('2.2.2', 'Embalagem Secundária', 'Fitas, plástico bolha, proteção interna', 'expense', 'custo_vendas', 3, 'D', false, true, '226587b9-2384-449f-9c17-1d3a6eef120b', 'CC-LOG', 'Logística', true),
  ('2.2.3', 'Embalagem Terciária', 'Paletes, stretch film, cintas', 'expense', 'custo_vendas', 3, 'D', false, true, '226587b9-2384-449f-9c17-1d3a6eef120b', 'CC-LOG', 'Logística', true),
  ('2.2.4', 'Materiais de Postagem', 'Etiquetas, lacres, materiais de envio', 'expense', 'custo_vendas', 3, 'D', false, true, '226587b9-2384-449f-9c17-1d3a6eef120b', 'CC-LOG', 'Logística', true);

-- ============================================================
-- 2. ALUGUÉIS: 1 sub-conta nova
-- ============================================================
INSERT INTO trade_chart_of_accounts (code, name, description, account_type, categoria_dre, nivel, natureza, is_group, permite_lancamento, parent_account_id, centro_custo, departamento, is_active)
VALUES
  ('3.1.1.3', 'Outros Espaços Operacionais', 'Showroom, ponto de venda, espaço temporário', 'expense', 'despesas_fixas', 4, 'D', false, true, 'e5b2a92c-4944-4c66-921c-cd9a10084faf', 'CC-ADM', 'Administrativo', true);

-- ============================================================
-- 3. SEGUROS: 3.1.11 vira grupo + 4 sub-contas
-- ============================================================
UPDATE trade_chart_of_accounts 
SET is_group = true, permite_lancamento = false
WHERE id = '75a502e7-559a-464c-901e-a8f2a02bb3c7'; -- 3.1.11

INSERT INTO trade_chart_of_accounts (code, name, description, account_type, categoria_dre, nivel, natureza, is_group, permite_lancamento, parent_account_id, centro_custo, departamento, is_active)
VALUES
  ('3.1.11.1', 'Seguro de Galpão/Depósito', 'Seguro patrimonial de depósitos e galpões', 'expense', 'despesas_fixas', 4, 'D', false, true, '75a502e7-559a-464c-901e-a8f2a02bb3c7', 'CC-LOG', 'Logística', true),
  ('3.1.11.2', 'Seguro de Escritório', 'Seguro patrimonial do escritório administrativo', 'expense', 'despesas_fixas', 4, 'D', false, true, '75a502e7-559a-464c-901e-a8f2a02bb3c7', 'CC-ADM', 'Administrativo', true),
  ('3.1.11.3', 'Seguro de Bens e Equipamentos', 'Seguro de máquinas, equipamentos e ativos', 'expense', 'despesas_fixas', 4, 'D', false, true, '75a502e7-559a-464c-901e-a8f2a02bb3c7', 'CC-OPS', 'Operações', true),
  ('3.1.11.4', 'Seguro de Veículos', 'Seguro de frota e veículos operacionais', 'expense', 'despesas_fixas', 4, 'D', false, true, '75a502e7-559a-464c-901e-a8f2a02bb3c7', 'CC-LOG', 'Logística', true);

-- ============================================================
-- 4. TARIFAS BANCÁRIAS: 3 sub-contas novas
-- ============================================================
INSERT INTO trade_chart_of_accounts (code, name, description, account_type, categoria_dre, nivel, natureza, is_group, permite_lancamento, parent_account_id, centro_custo, departamento, is_active)
VALUES
  ('2.7.2', 'Banco Itaú', 'Tarifas e taxas do Banco Itaú', 'expense', 'resultado_financeiro', 3, 'D', false, true, '307000d5-3046-4579-9cf2-4bbfa4f4e3a5', 'CC-FIN', 'Financeiro', true),
  ('2.7.3', 'Banco Bradesco', 'Tarifas e taxas do Banco Bradesco', 'expense', 'resultado_financeiro', 3, 'D', false, true, '307000d5-3046-4579-9cf2-4bbfa4f4e3a5', 'CC-FIN', 'Financeiro', true),
  ('2.7.4', 'Tarifas Bancárias Diversas', 'Tarifas de demais bancos e instituições financeiras', 'expense', 'resultado_financeiro', 3, 'D', false, true, '307000d5-3046-4579-9cf2-4bbfa4f4e3a5', 'CC-FIN', 'Financeiro', true);
