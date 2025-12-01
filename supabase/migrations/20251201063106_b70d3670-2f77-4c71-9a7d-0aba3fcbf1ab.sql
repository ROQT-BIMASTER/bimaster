-- =====================================================
-- PLANO DE CONTAS PROFISSIONAL - CPC/IFRS
-- =====================================================

-- 1. Atualizar estrutura da tabela trade_chart_of_accounts
ALTER TABLE trade_chart_of_accounts
ADD COLUMN IF NOT EXISTS nivel INTEGER DEFAULT 1 CHECK (nivel BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS natureza VARCHAR(1) DEFAULT 'D' CHECK (natureza IN ('D', 'C')),
ADD COLUMN IF NOT EXISTS permite_lancamento BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;

-- 2. Criar tabela de mapeamento de categorias
CREATE TABLE IF NOT EXISTS account_category_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES trade_chart_of_accounts(id) ON DELETE CASCADE,
  categoria_codigo VARCHAR(50),
  categoria_nome VARCHAR(255),
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(categoria_codigo, account_id)
);

-- 3. Inserir Plano de Contas Profissional (80 contas)

-- 1. ATIVO
INSERT INTO trade_chart_of_accounts (code, name, account_type, nivel, natureza, is_group, permite_lancamento, ordem, is_active)
VALUES 
('1', 'ATIVO', 'asset', 1, 'D', true, false, 1, true),
('1.1', 'ATIVO CIRCULANTE', 'asset', 2, 'D', true, false, 2, true),
('1.1.01', 'Caixa e Equivalentes', 'asset', 3, 'D', false, true, 3, true),
('1.1.02', 'Bancos', 'asset', 3, 'D', false, true, 4, true),
('1.1.03', 'Aplicações Financeiras', 'asset', 3, 'D', false, true, 5, true),
('1.1.04', 'Contas a Receber', 'asset', 3, 'D', false, true, 6, true),
('1.1.05', 'Estoques', 'asset', 3, 'D', false, true, 7, true),
('1.1.06', 'Adiantamentos', 'asset', 3, 'D', false, true, 8, true),
('1.2', 'ATIVO NÃO CIRCULANTE', 'asset', 2, 'D', true, false, 9, true),
('1.2.01', 'Imobilizado', 'asset', 3, 'D', false, true, 10, true),
('1.2.02', 'Intangível', 'asset', 3, 'D', false, true, 11, true);

-- 2. PASSIVO
INSERT INTO trade_chart_of_accounts (code, name, account_type, nivel, natureza, is_group, permite_lancamento, ordem, is_active)
VALUES 
('2', 'PASSIVO', 'liability', 1, 'C', true, false, 12, true),
('2.1', 'PASSIVO CIRCULANTE', 'liability', 2, 'C', true, false, 13, true),
('2.1.01', 'Fornecedores', 'liability', 3, 'C', false, true, 14, true),
('2.1.02', 'Obrigações Fiscais', 'liability', 3, 'C', false, true, 15, true),
('2.1.03', 'Obrigações Trabalhistas', 'liability', 3, 'C', false, true, 16, true),
('2.1.04', 'Empréstimos e Financiamentos', 'liability', 3, 'C', false, true, 17, true),
('2.1.05', 'Contas a Pagar', 'liability', 3, 'C', false, true, 18, true);

-- 4. RECEITAS
INSERT INTO trade_chart_of_accounts (code, name, account_type, nivel, natureza, is_group, permite_lancamento, ordem, is_active)
VALUES 
('4', 'RECEITAS', 'revenue', 1, 'C', true, false, 19, true),
('4.1', 'RECEITA OPERACIONAL', 'revenue', 2, 'C', true, false, 20, true),
('4.1.01', 'Vendas de Produtos', 'revenue', 3, 'C', false, true, 21, true),
('4.1.02', 'Vendas de Serviços', 'revenue', 3, 'C', false, true, 22, true),
('4.1.03', '(-) Devoluções', 'revenue', 3, 'D', false, true, 23, true),
('4.1.04', '(-) Descontos Concedidos', 'revenue', 3, 'D', false, true, 24, true),
('4.2', 'OUTRAS RECEITAS', 'revenue', 2, 'C', true, false, 25, true),
('4.2.01', 'Receitas Financeiras', 'revenue', 3, 'C', false, true, 26, true);

-- 5. CUSTOS
INSERT INTO trade_chart_of_accounts (code, name, account_type, nivel, natureza, is_group, permite_lancamento, ordem, is_active)
VALUES 
('5', 'CUSTOS', 'expense', 1, 'D', true, false, 27, true),
('5.1', 'CUSTO DAS MERCADORIAS VENDIDAS', 'expense', 2, 'D', true, false, 28, true),
('5.1.01', 'Compra de Mercadorias', 'expense', 3, 'D', false, true, 29, true),
('5.1.02', 'Frete sobre Compras', 'expense', 3, 'D', false, true, 30, true),
('5.2', 'CUSTOS DE PRODUÇÃO', 'expense', 2, 'D', true, false, 31, true),
('5.2.01', 'Matéria-Prima', 'expense', 3, 'D', false, true, 32, true),
('5.2.02', 'Mão de Obra Direta', 'expense', 3, 'D', false, true, 33, true);

-- 6. DESPESAS
INSERT INTO trade_chart_of_accounts (code, name, account_type, nivel, natureza, is_group, permite_lancamento, ordem, is_active)
VALUES 
('6', 'DESPESAS OPERACIONAIS', 'expense', 1, 'D', true, false, 34, true),
('6.1', 'DESPESAS COMERCIAIS/TRADE', 'expense', 2, 'D', true, false, 35, true),
('6.1.01', 'Material POP', 'cost_center', 3, 'D', false, true, 36, true),
('6.1.02', 'Promotores e Degustação', 'cost_center', 3, 'D', false, true, 37, true),
('6.1.03', 'Exposição Extra (Ponta de Gôndola)', 'cost_center', 3, 'D', false, true, 38, true),
('6.1.04', 'Bonificação e Descontos', 'cost_center', 3, 'D', false, true, 39, true),
('6.1.05', 'Eventos e Ativações', 'cost_center', 3, 'D', false, true, 40, true),
('6.1.06', 'Verba de Abertura de Loja', 'cost_center', 3, 'D', false, true, 41, true),
('6.1.07', 'Comissão de Vendedores', 'cost_center', 3, 'D', false, true, 42, true),
('6.1.08', 'Frete sobre Vendas', 'cost_center', 3, 'D', false, true, 43, true),

('6.2', 'DESPESAS ADMINISTRATIVAS', 'expense', 2, 'D', true, false, 44, true),
('6.2.01', 'Aluguel', 'expense', 3, 'D', false, true, 45, true),
('6.2.02', 'Energia Elétrica', 'expense', 3, 'D', false, true, 46, true),
('6.2.03', 'Água e Esgoto', 'expense', 3, 'D', false, true, 47, true),
('6.2.04', 'Telefone e Internet', 'expense', 3, 'D', false, true, 48, true),
('6.2.05', 'Material de Escritório', 'expense', 3, 'D', false, true, 49, true),
('6.2.06', 'Serviços Contábeis', 'expense', 3, 'D', false, true, 50, true),
('6.2.07', 'Serviços Jurídicos', 'expense', 3, 'D', false, true, 51, true),
('6.2.08', 'Seguros', 'expense', 3, 'D', false, true, 52, true),
('6.2.09', 'Manutenção e Reparos', 'expense', 3, 'D', false, true, 53, true),
('6.2.10', 'Depreciação', 'expense', 3, 'D', false, true, 54, true),

('6.3', 'DESPESAS COM PESSOAL', 'expense', 2, 'D', true, false, 55, true),
('6.3.01', 'Salários', 'expense', 3, 'D', false, true, 56, true),
('6.3.02', 'Encargos Sociais (INSS, FGTS)', 'expense', 3, 'D', false, true, 57, true),
('6.3.03', 'Vale Transporte', 'expense', 3, 'D', false, true, 58, true),
('6.3.04', 'Vale Alimentação/Refeição', 'expense', 3, 'D', false, true, 59, true),
('6.3.05', 'Plano de Saúde', 'expense', 3, 'D', false, true, 60, true),
('6.3.06', 'Treinamento e Desenvolvimento', 'expense', 3, 'D', false, true, 61, true),
('6.3.07', 'Férias e 13º Salário', 'expense', 3, 'D', false, true, 62, true),

('6.4', 'DESPESAS DE MARKETING', 'expense', 2, 'D', true, false, 63, true),
('6.4.01', 'Publicidade e Propaganda', 'expense', 3, 'D', false, true, 64, true),
('6.4.02', 'Marketing Digital', 'expense', 3, 'D', false, true, 65, true),
('6.4.03', 'Patrocínios', 'expense', 3, 'D', false, true, 66, true),
('6.4.04', 'Brindes e Amostras', 'expense', 3, 'D', false, true, 67, true),

('6.5', 'DESPESAS DE LOGÍSTICA', 'expense', 2, 'D', true, false, 68, true),
('6.5.01', 'Armazenagem', 'expense', 3, 'D', false, true, 69, true),
('6.5.02', 'Distribuição', 'expense', 3, 'D', false, true, 70, true),
('6.5.03', 'Combustível', 'expense', 3, 'D', false, true, 71, true),
('6.5.04', 'Manutenção de Veículos', 'expense', 3, 'D', false, true, 72, true);

-- 7. DESPESAS FINANCEIRAS
INSERT INTO trade_chart_of_accounts (code, name, account_type, nivel, natureza, is_group, permite_lancamento, ordem, is_active)
VALUES 
('7', 'DESPESAS FINANCEIRAS', 'expense', 1, 'D', true, false, 73, true),
('7.1.01', 'Juros Passivos', 'expense', 3, 'D', false, true, 74, true),
('7.1.02', 'Taxas Bancárias', 'expense', 3, 'D', false, true, 75, true),
('7.1.03', 'IOF', 'expense', 3, 'D', false, true, 76, true),
('7.1.04', 'Variação Cambial Passiva', 'expense', 3, 'D', false, true, 77, true);

-- 8. VERBAS/ORÇAMENTOS
INSERT INTO trade_chart_of_accounts (code, name, account_type, nivel, natureza, is_group, permite_lancamento, ordem, is_active)
VALUES 
('8', 'VERBAS E ORÇAMENTOS', 'budget', 1, 'D', true, false, 78, true),
('8.1', 'VERBAS COMERCIAIS', 'budget', 2, 'D', true, false, 79, true),
('8.1.01', 'Verba Trade Marketing', 'budget', 3, 'D', false, true, 80, true),
('8.1.02', 'Verba Eventos', 'budget', 3, 'D', false, true, 81, true),
('8.1.03', 'Verba Merchandising', 'budget', 3, 'D', false, true, 82, true);

-- 4. Criar mapeamentos automáticos das categorias existentes
INSERT INTO account_category_mapping (account_id, categoria_codigo, categoria_nome, confidence_score)
SELECT 
  tca.id,
  'COMPRA_MERCADORIA',
  'Compra de Mercadoria',
  1.0
FROM trade_chart_of_accounts tca
WHERE tca.code = '5.1.01'
ON CONFLICT (categoria_codigo, account_id) DO NOTHING;

INSERT INTO account_category_mapping (account_id, categoria_codigo, categoria_nome, confidence_score)
SELECT 
  tca.id,
  'ALUGUEL',
  'Aluguel',
  1.0
FROM trade_chart_of_accounts tca
WHERE tca.code = '6.2.01'
ON CONFLICT (categoria_codigo, account_id) DO NOTHING;

INSERT INTO account_category_mapping (account_id, categoria_codigo, categoria_nome, confidence_score)
SELECT 
  tca.id,
  'ENERGIA',
  'Energia Elétrica',
  1.0
FROM trade_chart_of_accounts tca
WHERE tca.code = '6.2.02'
ON CONFLICT (categoria_codigo, account_id) DO NOTHING;

INSERT INTO account_category_mapping (account_id, categoria_codigo, categoria_nome, confidence_score)
SELECT 
  tca.id,
  'SALARIOS',
  'Salários',
  1.0
FROM trade_chart_of_accounts tca
WHERE tca.code = '6.3.01'
ON CONFLICT (categoria_codigo, account_id) DO NOTHING;

INSERT INTO account_category_mapping (account_id, categoria_codigo, categoria_nome, confidence_score)
SELECT 
  tca.id,
  'MARKETING',
  'Marketing Digital',
  1.0
FROM trade_chart_of_accounts tca
WHERE tca.code = '6.4.02'
ON CONFLICT (categoria_codigo, account_id) DO NOTHING;

-- 5. Criar políticas RLS
ALTER TABLE trade_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_category_mapping ENABLE ROW LEVEL SECURITY;

-- Políticas para trade_chart_of_accounts
DROP POLICY IF EXISTS "Visualizar plano de contas" ON trade_chart_of_accounts;
CREATE POLICY "Visualizar plano de contas"
  ON trade_chart_of_accounts FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin pode gerenciar plano de contas" ON trade_chart_of_accounts;
CREATE POLICY "Admin pode gerenciar plano de contas"
  ON trade_chart_of_accounts FOR ALL
  TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()))
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

-- Políticas para account_category_mapping
DROP POLICY IF EXISTS "Visualizar mapeamentos" ON account_category_mapping;
CREATE POLICY "Visualizar mapeamentos"
  ON account_category_mapping FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin pode gerenciar mapeamentos" ON account_category_mapping;
CREATE POLICY "Admin pode gerenciar mapeamentos"
  ON account_category_mapping FOR ALL
  TO authenticated
  USING (public.is_admin_or_supervisor(auth.uid()))
  WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

-- 6. Atualizar hierarquia parent_account_id
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '1') WHERE code LIKE '1.%' AND code != '1';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '1.1') WHERE code LIKE '1.1.%' AND code != '1.1';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '1.2') WHERE code LIKE '1.2.%' AND code != '1.2';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '2') WHERE code LIKE '2.%' AND code != '2';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '2.1') WHERE code LIKE '2.1.%' AND code != '2.1';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '4') WHERE code LIKE '4.%' AND code != '4';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '4.1') WHERE code LIKE '4.1.%' AND code != '4.1';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '4.2') WHERE code LIKE '4.2.%' AND code != '4.2';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '5') WHERE code LIKE '5.%' AND code != '5';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '5.1') WHERE code LIKE '5.1.%' AND code != '5.1';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '5.2') WHERE code LIKE '5.2.%' AND code != '5.2';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '6') WHERE code LIKE '6.%' AND code != '6';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '6.1') WHERE code LIKE '6.1.%' AND code != '6.1';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '6.2') WHERE code LIKE '6.2.%' AND code != '6.2';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '6.3') WHERE code LIKE '6.3.%' AND code != '6.3';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '6.4') WHERE code LIKE '6.4.%' AND code != '6.4';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '6.5') WHERE code LIKE '6.5.%' AND code != '6.5';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '7') WHERE code LIKE '7.%' AND code != '7';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '8') WHERE code LIKE '8.%' AND code != '8';
UPDATE trade_chart_of_accounts SET parent_account_id = (SELECT id FROM trade_chart_of_accounts WHERE code = '8.1') WHERE code LIKE '8.1.%' AND code != '8.1';

-- 7. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_chart_accounts_code ON trade_chart_of_accounts(code);
CREATE INDEX IF NOT EXISTS idx_chart_accounts_parent ON trade_chart_of_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_chart_accounts_nivel ON trade_chart_of_accounts(nivel);
CREATE INDEX IF NOT EXISTS idx_category_mapping_category ON account_category_mapping(categoria_codigo);