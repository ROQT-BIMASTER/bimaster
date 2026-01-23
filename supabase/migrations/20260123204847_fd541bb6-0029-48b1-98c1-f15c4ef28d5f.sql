
-- =====================================================
-- FASE 1: CRIAR CONTAS ESPECÍFICAS PARA ENCARGOS
-- =====================================================

-- Criar conta FGTS se não existir
INSERT INTO trade_chart_of_accounts (code, name, description, account_type, is_active, codigo_dre_gerencial)
SELECT '3.5.20', 'FGTS', 'Fundo de Garantia por Tempo de Serviço', 'expense', true, '3.2.4'
WHERE NOT EXISTS (SELECT 1 FROM trade_chart_of_accounts WHERE name = 'FGTS' AND codigo_dre_gerencial = '3.2.4');

-- Criar conta Sindicato/Contribuições se não existir
INSERT INTO trade_chart_of_accounts (code, name, description, account_type, is_active, codigo_dre_gerencial)
SELECT '3.5.21', 'Sindicato e Contribuições', 'Contribuições sindicais e associativas', 'expense', true, '3.2.14'
WHERE NOT EXISTS (SELECT 1 FROM trade_chart_of_accounts WHERE name ILIKE '%Sindicato%' AND codigo_dre_gerencial = '3.2.14');

-- Criar conta PIS específica
INSERT INTO trade_chart_of_accounts (code, name, description, account_type, is_active, codigo_dre_gerencial)
SELECT '3.4.11', 'PIS sobre Faturamento', 'PIS sobre faturamento', 'expense', true, '2.4.6'
WHERE NOT EXISTS (SELECT 1 FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = '2.4.6' AND is_active = true);

-- Criar conta COFINS específica
INSERT INTO trade_chart_of_accounts (code, name, description, account_type, is_active, codigo_dre_gerencial)
SELECT '3.4.12', 'COFINS sobre Faturamento', 'COFINS sobre faturamento', 'expense', true, '2.4.3'
WHERE NOT EXISTS (SELECT 1 FROM trade_chart_of_accounts WHERE name ILIKE '%COFINS%' AND codigo_dre_gerencial = '2.4.3');

-- =====================================================
-- FASE 2: ATUALIZAR MAPEAMENTOS DRE EXISTENTES
-- =====================================================

-- Corrigir INSS para 3.2.5 (já existe como 3.5.05)
UPDATE trade_chart_of_accounts 
SET codigo_dre_gerencial = '3.2.5'
WHERE code = '3.5.05' AND name = 'INSS';

-- Garantir que 3.4.10 PIS tenha código correto
UPDATE trade_chart_of_accounts 
SET codigo_dre_gerencial = '2.4.6'
WHERE code = '3.4.10' AND name = 'PIS';

-- =====================================================
-- FASE 3: CORRIGIR CLASSIFICAÇÕES EM CONTAS_PAGAR
-- =====================================================

-- 3.1 FGTS → Conta FGTS (3.2.4)
UPDATE contas_pagar 
SET 
  plano_contas_id = (SELECT id FROM trade_chart_of_accounts WHERE name = 'FGTS' AND codigo_dre_gerencial = '3.2.4' LIMIT 1),
  plano_contas_codigo = '3.2.4',
  plano_contas_nome = 'FGTS'
WHERE fornecedor_nome = 'FGTS';

-- 3.2 INSS → Conta INSS (3.2.5)
UPDATE contas_pagar 
SET 
  plano_contas_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '3.5.05' AND name = 'INSS' LIMIT 1),
  plano_contas_codigo = '3.2.5',
  plano_contas_nome = 'INSS'
WHERE fornecedor_nome = 'INSS';

-- 3.3 Sindicato → Sindicato/Contribuições (3.2.14)
UPDATE contas_pagar 
SET 
  plano_contas_id = (SELECT id FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = '3.2.14' AND is_active = true LIMIT 1),
  plano_contas_codigo = '3.2.14',
  plano_contas_nome = 'Sindicato e Contribuições'
WHERE fornecedor_nome ILIKE '%SINDICATO%';

-- 3.4 IRRF sobre Folha → IRRF Funcionários (3.2.14)
UPDATE contas_pagar 
SET 
  plano_contas_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '3.5.14' LIMIT 1),
  plano_contas_codigo = '3.2.14',
  plano_contas_nome = 'IRRF Funcionários'
WHERE (fornecedor_nome ILIKE '%IRRF%S/%FOLHA%' OR fornecedor_nome ILIKE '%IRRF%FOLHA%');

-- =====================================================
-- FASE 4: CORRIGIR TRIBUTOS FEDERAIS (DARF específicos)
-- =====================================================

-- 4.1 DARF PIS → PIS (2.4.6)
UPDATE contas_pagar 
SET 
  plano_contas_id = (SELECT id FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = '2.4.6' AND is_active = true LIMIT 1),
  plano_contas_codigo = '2.4.6',
  plano_contas_nome = 'PIS'
WHERE fornecedor_nome ILIKE '%DARF PIS%' OR fornecedor_nome ILIKE '%DARF%PIS%';

-- 4.2 DARF COFINS → COFINS (2.4.3)
UPDATE contas_pagar 
SET 
  plano_contas_id = (SELECT id FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = '2.4.3' AND is_active = true LIMIT 1),
  plano_contas_codigo = '2.4.3',
  plano_contas_nome = 'COFINS'
WHERE fornecedor_nome ILIKE '%DARF COFINS%' OR fornecedor_nome ILIKE '%DARF%COFINS%';

-- 4.3 DARF IRPJ → IRPJ (2.4.5)
UPDATE contas_pagar 
SET 
  plano_contas_id = (SELECT id FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = '2.4.5' AND is_active = true LIMIT 1),
  plano_contas_codigo = '2.4.5',
  plano_contas_nome = 'IRPJ'
WHERE fornecedor_nome ILIKE '%DARF IRPJ%' OR fornecedor_nome ILIKE '%DARF%IRPJ%';

-- 4.4 DARF CSLL/CSOC → CSLL (2.4.4)
UPDATE contas_pagar 
SET 
  plano_contas_id = (SELECT id FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = '2.4.4' AND is_active = true LIMIT 1),
  plano_contas_codigo = '2.4.4',
  plano_contas_nome = 'CSLL'
WHERE fornecedor_nome ILIKE '%DARF CSOC%' OR fornecedor_nome ILIKE '%DARF CSLL%' OR fornecedor_nome ILIKE '%DARF%CSLL%';

-- =====================================================
-- FASE 5: CORRIGIR SIMPLES NACIONAL E ICMS
-- =====================================================

-- 5.1 Simples Nacional → 2.4.1
UPDATE contas_pagar 
SET 
  plano_contas_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '3.4.03' AND name = 'Simples Nacional' LIMIT 1),
  plano_contas_codigo = '2.4.1',
  plano_contas_nome = 'Simples Nacional'
WHERE categoria_nome = 'SIMPLES NACIONAL';

-- 5.2 GNRE / Tributos Estaduais → ICMS (2.4.2)
UPDATE contas_pagar 
SET 
  plano_contas_id = (SELECT id FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = '2.4.2' AND is_active = true LIMIT 1),
  plano_contas_codigo = '2.4.2',
  plano_contas_nome = 'ICMS sobre Vendas'
WHERE fornecedor_nome ILIKE '%GNRE%' OR categoria_nome = 'TRIBUTOS ESTADUAIS';

-- =====================================================
-- FASE 6: INSERIR REGRAS DE CLASSIFICAÇÃO IA
-- =====================================================

-- Inserir regras para classificação automática futura
INSERT INTO account_classification_rules (categoria_nome, fornecedor_nome, plano_contas_id, confidence_score, created_at)
SELECT 'IMPOSTOS/TAXAS', 'FGTS', 
  (SELECT id FROM trade_chart_of_accounts WHERE name = 'FGTS' AND codigo_dre_gerencial = '3.2.4' LIMIT 1),
  0.99, NOW()
WHERE NOT EXISTS (SELECT 1 FROM account_classification_rules WHERE fornecedor_nome = 'FGTS');

INSERT INTO account_classification_rules (categoria_nome, fornecedor_nome, plano_contas_id, confidence_score, created_at)
SELECT 'IMPOSTOS/TAXAS', 'INSS', 
  (SELECT id FROM trade_chart_of_accounts WHERE code = '3.5.05' AND name = 'INSS' LIMIT 1),
  0.99, NOW()
WHERE NOT EXISTS (SELECT 1 FROM account_classification_rules WHERE fornecedor_nome = 'INSS');

INSERT INTO account_classification_rules (categoria_nome, fornecedor_nome, plano_contas_id, confidence_score, created_at)
SELECT 'TRIBUTOS FEDERAIS', 'DARF PIS%', 
  (SELECT id FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = '2.4.6' LIMIT 1),
  0.99, NOW()
WHERE NOT EXISTS (SELECT 1 FROM account_classification_rules WHERE fornecedor_nome = 'DARF PIS%');

INSERT INTO account_classification_rules (categoria_nome, fornecedor_nome, plano_contas_id, confidence_score, created_at)
SELECT 'TRIBUTOS FEDERAIS', 'DARF COFINS%', 
  (SELECT id FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = '2.4.3' LIMIT 1),
  0.99, NOW()
WHERE NOT EXISTS (SELECT 1 FROM account_classification_rules WHERE fornecedor_nome = 'DARF COFINS%');

INSERT INTO account_classification_rules (categoria_nome, fornecedor_nome, plano_contas_id, confidence_score, created_at)
SELECT 'SIMPLES NACIONAL', '%', 
  (SELECT id FROM trade_chart_of_accounts WHERE code = '3.4.03' LIMIT 1),
  0.99, NOW()
WHERE NOT EXISTS (SELECT 1 FROM account_classification_rules WHERE categoria_nome = 'SIMPLES NACIONAL');
