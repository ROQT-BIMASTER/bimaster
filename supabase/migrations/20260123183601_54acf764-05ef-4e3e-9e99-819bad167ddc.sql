-- Fase 1: Adicionar coluna para código DRE gerencial
ALTER TABLE trade_chart_of_accounts 
ADD COLUMN IF NOT EXISTS codigo_dre_gerencial VARCHAR(20);

COMMENT ON COLUMN trade_chart_of_accounts.codigo_dre_gerencial IS 
'Código do plano de contas gerencial da empresa (ex: 3.2.1 = Salários CLT)';

-- Fase 2: Receitas por Canal de Venda (Grupo 4.1)
INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('4.1.01', 'Boletos - Banco', 'revenue', 'C', 3, 'receita_bruta', '1.1', false, true, true),
  ('4.1.02', 'Vendas à Vista', 'revenue', 'C', 3, 'receita_bruta', '1.2', false, true, true),
  ('4.1.03', 'Cheque', 'revenue', 'C', 3, 'receita_bruta', '1.3', false, true, true),
  ('4.1.04', 'Mercado Pago', 'revenue', 'C', 3, 'receita_bruta', '1.4', false, true, true),
  ('4.1.05', 'Dinheiro', 'revenue', 'C', 3, 'receita_bruta', '1.5', false, true, true),
  ('4.1.06', 'Tabela Verão', 'revenue', 'C', 3, 'receita_bruta', '1.6', false, true, true),
  ('4.1.07', 'Pague Seguro', 'revenue', 'C', 3, 'receita_bruta', '1.7', false, true, true),
  ('4.1.08', '(+) Juros Recebidos', 'revenue', 'C', 3, 'receita_bruta', '1.8', false, true, true),
  ('4.1.09', '(-) Descontos Concedidos', 'revenue', 'D', 3, 'deducoes', '1.9', false, true, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial,
  categoria_dre = EXCLUDED.categoria_dre;

-- Fase 3: Custos por Fornecedor/Marca (Grupo 3.1)
INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.1.05', 'Compras Ruby Rose', 'expense', 'D', 3, 'custo_vendas', '2.1.1', false, true, true),
  ('3.1.06', 'Compras Melu', 'expense', 'D', 3, 'custo_vendas', '2.1.2', false, true, true),
  ('3.1.07', 'Embalagens e Materiais Postagem', 'expense', 'D', 3, 'custo_vendas', '2.2', false, true, true),
  ('3.1.08', 'Transportadoras', 'expense', 'D', 3, 'custo_vendas', '2.3.1', false, true, true),
  ('3.1.09', 'Agregados (Frete)', 'expense', 'D', 3, 'custo_vendas', '2.3.2', false, true, true),
  ('3.1.10', 'Correio (Frete)', 'expense', 'D', 3, 'custo_vendas', '2.3.3', false, true, true),
  ('3.1.11', 'Escoltas', 'expense', 'D', 3, 'custo_vendas', '2.3.4', false, true, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial,
  categoria_dre = EXCLUDED.categoria_dre;

-- Fase 4: Impostos sobre Vendas (Grupo 3.4)
INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.4.05', 'Simples Nacional', 'expense', 'D', 3, 'deducoes', '2.4.1', false, true, true),
  ('3.4.06', 'ICMS sobre Vendas', 'expense', 'D', 3, 'deducoes', '2.4.2', false, true, true),
  ('3.4.07', 'COFINS', 'expense', 'D', 3, 'deducoes', '2.4.3', false, true, true),
  ('3.4.08', 'CSLL', 'expense', 'D', 3, 'impostos_lucro', '2.4.4', false, true, true),
  ('3.4.09', 'IRPJ', 'expense', 'D', 3, 'impostos_lucro', '2.4.5', false, true, true),
  ('3.4.10', 'PIS', 'expense', 'D', 3, 'deducoes', '2.4.6', false, true, true),
  ('3.4.11', 'Tarifas Mercado Pago', 'expense', 'D', 3, 'deducoes', '2.6.1', false, true, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial,
  categoria_dre = EXCLUDED.categoria_dre;

-- Fase 5: Despesas Administrativas Detalhadas (Grupo 3.3)
INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.3.21', 'Aluguel do Estabelecimento', 'expense', 'D', 3, 'despesas_fixas', '3.1.1', false, true, true),
  ('3.3.22', 'Internet', 'expense', 'D', 3, 'despesas_fixas', '3.1.4', false, true, true),
  ('3.3.23', 'Telefone Fixo', 'expense', 'D', 3, 'despesas_fixas', '3.1.5.1', false, true, true),
  ('3.3.24', 'Telefone Móvel', 'expense', 'D', 3, 'despesas_fixas', '3.1.5.2', false, true, true),
  ('3.3.25', 'IPTU', 'expense', 'D', 3, 'despesas_fixas', '3.1.6.1', false, true, true),
  ('3.3.26', 'Material de Escritório/Informática', 'expense', 'D', 3, 'despesas_fixas', '3.1.7', false, true, true),
  ('3.3.27', 'Sistema Integrado (Result)', 'expense', 'D', 3, 'despesas_fixas', '3.1.8', false, true, true),
  ('3.3.28', 'Segurança/Monitoramento', 'expense', 'D', 3, 'despesas_fixas', '3.1.9.1', false, true, true),
  ('3.3.29', 'Limpeza Terceirizada', 'expense', 'D', 3, 'despesas_fixas', '3.1.9.2', false, true, true),
  ('3.3.30', 'Freelancers', 'expense', 'D', 3, 'despesas_fixas', '3.1.9.4', false, true, true),
  ('3.3.31', 'Dedetização', 'expense', 'D', 3, 'despesas_fixas', '3.1.9.5', false, true, true),
  ('3.3.32', 'Impressões', 'expense', 'D', 3, 'despesas_fixas', '3.1.9.6', false, true, true),
  ('3.3.33', 'Advogado', 'expense', 'D', 3, 'despesas_fixas', '3.1.9.7', false, true, true),
  ('3.3.34', 'Manutenção Predial', 'expense', 'D', 3, 'despesas_fixas', '3.1.10.1', false, true, true),
  ('3.3.35', 'Manutenção Máquinas/Equipamentos', 'expense', 'D', 3, 'despesas_fixas', '3.1.10.2', false, true, true),
  ('3.3.36', 'Veículos - Manutenção', 'expense', 'D', 3, 'despesas_fixas', '3.1.11.1', false, true, true),
  ('3.3.37', 'IPVA/Licenciamento', 'expense', 'D', 3, 'despesas_fixas', '3.1.11.2', false, true, true),
  ('3.3.38', 'Seguros', 'expense', 'D', 3, 'despesas_fixas', '3.1.12', false, true, true),
  ('3.3.39', 'Cartório', 'expense', 'D', 3, 'despesas_fixas', '3.1.13', false, true, true),
  ('3.3.40', 'Material Limpeza/Higiene/Copa', 'expense', 'D', 3, 'despesas_fixas', '3.1.15', false, true, true),
  ('3.3.41', 'Uber/Táxi', 'expense', 'D', 3, 'despesas_fixas', '3.1.16', false, true, true),
  ('3.3.42', 'Refeições', 'expense', 'D', 3, 'despesas_fixas', '3.1.17', false, true, true),
  ('3.3.43', 'Reembolso de Despesas', 'expense', 'D', 3, 'despesas_fixas', '3.1.18', false, true, true),
  ('3.3.44', 'Despesas de Viagem', 'expense', 'D', 3, 'despesas_fixas', '3.1.19', false, true, true),
  ('3.3.45', 'Locações Diversas', 'expense', 'D', 3, 'despesas_fixas', '3.1.20', false, true, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial,
  categoria_dre = EXCLUDED.categoria_dre;

-- Fase 6: Grupo Despesas com Pessoal (3.5)
INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.5', 'DESPESAS COM PESSOAL', 'expense', 'D', 2, NULL, '3.2', true, false, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial;

INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.5.01', 'Salários CLT', 'expense', 'D', 3, 'despesas_fixas', '3.2.1', false, true, true),
  ('3.5.02', 'Contratados PJ', 'expense', 'D', 3, 'despesas_fixas', '3.2.2', false, true, true),
  ('3.5.03', 'Vale Transporte', 'expense', 'D', 3, 'despesas_fixas', '3.2.3', false, true, true),
  ('3.5.04', 'FGTS', 'expense', 'D', 3, 'despesas_fixas', '3.2.4', false, true, true),
  ('3.5.05', 'INSS', 'expense', 'D', 3, 'despesas_fixas', '3.2.5', false, true, true),
  ('3.5.06', 'Medicina do Trabalho', 'expense', 'D', 3, 'despesas_fixas', '3.2.6', false, true, true),
  ('3.5.07', 'Sistema de Ponto', 'expense', 'D', 3, 'despesas_fixas', '3.2.7', false, true, true),
  ('3.5.08', '13º Salário', 'expense', 'D', 3, 'despesas_fixas', '3.2.8', false, true, true),
  ('3.5.09', 'Férias', 'expense', 'D', 3, 'despesas_fixas', '3.2.9', false, true, true),
  ('3.5.10', 'Rescisões e Encargos', 'expense', 'D', 3, 'despesas_fixas', '3.2.10', false, true, true),
  ('3.5.11', 'Café Funcionários', 'expense', 'D', 3, 'despesas_fixas', '3.2.11', false, true, true),
  ('3.5.12', 'Treinamentos', 'expense', 'D', 3, 'despesas_fixas', '3.2.12', false, true, true),
  ('3.5.13', 'Cesta Básica', 'expense', 'D', 3, 'despesas_fixas', '3.2.13', false, true, true),
  ('3.5.14', 'IRRF Funcionários', 'expense', 'D', 3, 'despesas_fixas', '3.2.14', false, true, true),
  ('3.5.15', 'Confraternizações', 'expense', 'D', 3, 'despesas_fixas', '3.2.15', false, true, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial,
  categoria_dre = EXCLUDED.categoria_dre;

-- Fase 7: Grupo Despesas de Marketing (3.6)
INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.6', 'DESPESAS DE MARKETING', 'expense', 'D', 2, NULL, '3.3', true, false, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial;

INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.6.01', 'Publicidade e Propaganda', 'expense', 'D', 3, 'despesas_fixas', '3.3.1', false, true, true),
  ('3.6.02', 'Eventos', 'expense', 'D', 3, 'despesas_fixas', '3.3.2', false, true, true),
  ('3.6.03', 'Prêmios/Brindes', 'expense', 'D', 3, 'despesas_fixas', '3.3.3', false, true, true),
  ('3.6.04', 'Patrocínio', 'expense', 'D', 3, 'despesas_fixas', '3.3.4', false, true, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial,
  categoria_dre = EXCLUDED.categoria_dre;

-- Fase 8: Grupo Despesas Financeiras (3.7)
INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.7', 'DESPESAS FINANCEIRAS', 'expense', 'D', 2, NULL, '3.4', true, false, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial;

INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.7.01', 'Despesas Bancárias', 'expense', 'D', 3, 'despesas_fixas', '3.4.1', false, true, true),
  ('3.7.02', 'Juros de Antecipação Recebíveis', 'expense', 'D', 3, 'despesas_fixas', '4.3.3', false, true, true),
  ('3.7.03', 'Juros Pagos', 'expense', 'D', 3, 'despesas_fixas', '4.3.6', false, true, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial,
  categoria_dre = EXCLUDED.categoria_dre;

-- Fase 9: Grupo Retiradas dos Sócios (3.8)
INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.8', 'RETIRADAS DOS SÓCIOS', 'expense', 'D', 2, NULL, '3.5', true, false, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial;

INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('3.8.01', 'Pró-labore Ahmad', 'expense', 'D', 3, 'despesas_fixas', '3.5.1', false, true, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial,
  categoria_dre = EXCLUDED.categoria_dre;

-- Fase 10: Grupo Patrimônio e Investimentos (6)
INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('6', 'PATRIMÔNIO E INVESTIMENTOS', 'asset', 'D', 1, NULL, '4', true, false, true),
  ('6.1', 'Outras Receitas/Despesas', 'asset', 'D', 2, NULL, '4.1', true, false, true),
  ('6.2', 'Imobilizado', 'asset', 'D', 2, NULL, '4.2', true, false, true),
  ('6.3', 'Financiamentos', 'liability', 'C', 2, NULL, '4.3', true, false, true),
  ('6.4', 'Capital Social', 'asset', 'C', 2, NULL, '4.4', true, false, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial;

INSERT INTO trade_chart_of_accounts (code, name, account_type, natureza, nivel, categoria_dre, codigo_dre_gerencial, is_group, permite_lancamento, is_active)
VALUES 
  ('6.1.01', 'Receitas Não Operacionais', 'revenue', 'C', 3, NULL, '4.1.1', false, true, true),
  ('6.1.02', 'Despesas Não Operacionais', 'expense', 'D', 3, NULL, '4.1.2', false, true, true),
  ('6.2.01', 'Venda de Imobilizado', 'revenue', 'C', 3, NULL, '4.2.1', false, true, true),
  ('6.2.02', 'Compra de Imobilizado', 'expense', 'D', 3, NULL, '4.2.2', false, true, true),
  ('6.2.03', 'Equipamentos/Utensílios', 'expense', 'D', 3, NULL, '4.2.3', false, true, true),
  ('6.2.04', 'Instalações', 'expense', 'D', 3, NULL, '4.2.4', false, true, true),
  ('6.2.05', 'Móveis e Decoração', 'expense', 'D', 3, NULL, '4.2.5', false, true, true),
  ('6.2.06', 'Software/Hardware', 'expense', 'D', 3, NULL, '4.2.6', false, true, true),
  ('6.3.01', 'Amortização Empréstimos Bancos', 'expense', 'D', 3, NULL, '4.3.1', false, true, true),
  ('6.3.02', 'Empréstimos Tomados', 'liability', 'C', 3, NULL, '4.3.2', false, true, true),
  ('6.3.03', 'Empréstimos Terceiros - Pagamento', 'expense', 'D', 3, NULL, '4.3.4', false, true, true),
  ('6.3.04', 'Receitas Financeiras', 'revenue', 'C', 3, NULL, '4.3.5', false, true, true),
  ('6.3.05', 'Parcelamento Simples Nacional', 'expense', 'D', 3, NULL, '4.3.7', false, true, true),
  ('6.3.06', 'Parcelamento INSS', 'expense', 'D', 3, NULL, '4.3.8', false, true, true),
  ('6.3.07', 'Parcelamentos Outros Impostos', 'expense', 'D', 3, NULL, '4.3.9', false, true, true),
  ('6.4.01', 'Aporte de Capital', 'asset', 'C', 3, NULL, '4.4.1', false, true, true),
  ('6.4.02', 'Retirada de Lucros', 'expense', 'D', 3, NULL, '4.4.2', false, true, true)
ON CONFLICT (code) DO UPDATE SET 
  codigo_dre_gerencial = EXCLUDED.codigo_dre_gerencial;