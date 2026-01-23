-- =====================================================
-- BASE DE CONHECIMENTO PARA CLASSIFICAÇÃO IA
-- Importar padrões do histórico do gerente financeiro
-- =====================================================

-- 1. Criar tabela para armazenar exemplos de treinamento
CREATE TABLE IF NOT EXISTS public.ai_training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo TEXT,
  codigo_dre TEXT NOT NULL,
  historico TEXT NOT NULL,
  fornecedor TEXT,
  valor NUMERIC,
  mes_referencia TEXT,
  complemento TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index para busca rápida
CREATE INDEX IF NOT EXISTS idx_training_codigo_dre ON ai_training_examples(codigo_dre);
CREATE INDEX IF NOT EXISTS idx_training_historico ON ai_training_examples USING gin(to_tsvector('portuguese', historico));

-- 2. Inserir regras de classificação aprendidas do histórico (padrões mais frequentes)
-- Cada regra representa um mapeamento: categoria + fornecedor → código DRE + conta

INSERT INTO account_classification_rules (
  categoria_nome, 
  fornecedor_nome, 
  departamento_id, 
  plano_contas_id, 
  confidence_score, 
  times_used
)
SELECT DISTINCT ON (categoria, fornecedor)
  categoria,
  NULLIF(fornecedor, ''),
  (SELECT id FROM departamentos WHERE nome ILIKE '%' || COALESCE(
    CASE 
      WHEN categoria ILIKE '%ALUGUEL%' THEN 'Administração'
      WHEN categoria ILIKE '%CMV%' OR categoria ILIKE '%COMPRA%MERCADORIA%' THEN 'Comercial'
      WHEN categoria ILIKE '%SALARIO%' OR categoria ILIKE '%FGTS%' OR categoria ILIKE '%INSS%' THEN 'RH'
      WHEN categoria ILIKE '%MARKETING%' OR categoria ILIKE '%PUBLICIDADE%' THEN 'Marketing'
      WHEN categoria ILIKE '%FRETE%' OR categoria ILIKE '%TRANSPORTE%' THEN 'Logística'
      WHEN categoria ILIKE '%IMPOSTO%' OR categoria ILIKE '%TRIBUT%' THEN 'Fiscal'
      WHEN categoria ILIKE '%TECNOLOGIA%' OR categoria ILIKE '%SOFTWARE%' THEN 'TI'
      ELSE 'Financeiro'
    END
  , 'Financeiro') || '%' LIMIT 1),
  (SELECT id FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = codigo ORDER BY id LIMIT 1),
  0.95,
  contagem
FROM (
  VALUES
    -- ALUGUEIS
    ('ALUGUEL DE DEPÓSITO', 'SAO FRANCISCO EMPREENDIMENTOS IMOBILARIO', '3.1.1.1', 50),
    ('ALUGUEL DE ESCRITÓRIO', 'IMOBILIARIA SINVAL RIBEIRO IMOVEIS LTDA', '3.1.1.2', 30),
    ('LOCAÇÃO PALHETEIRA ELETRICA', 'TME COMERCIO DE EMPILHADEIRA', '3.1.19', 20),
    ('LOCAÇÃO DE NOTEBOOKS', 'ALOC LOCAÇÃO', '3.1.19', 45),
    
    -- CMV / COMPRAS
    ('COMPRA DE MERCADORIA PARA REVENDA', 'NELIDA/FABULOUS', '2.1.1', 500),
    ('COMPRA DE MERCADORIA PARA REVENDA', 'BIO-SINERGIA', '2.1.1', 80),
    ('COMPRA DE MERCADORIA PARA REVENDA', 'RODRIGUES LOURENCO & PEREIRA LTDA', '2.1.1', 30),
    ('COMPRA DE MERCADORIA PARA REVENDA', 'BIO SINERGIA COSMETICO', '2.1.1', 25),
    
    -- TARIFAS BANCÁRIAS
    ('TARIFAS BANCARIAS', NULL, '3.4.1', 200),
    ('DESPESAS BANCÁRIAS', NULL, '3.4.1', 150),
    
    -- REEMBOLSOS
    ('REEMBOLSOS DIVERSOS', NULL, '3.1.17', 100),
    ('REEMBOLSO', 'ANA PAULA SANTOS DA CUNHA', '3.1.17', 40),
    
    -- SIMPLES NACIONAL E TRIBUTOS
    ('SIMPLES NACIONAL', 'SIMPLES NACIONAL', '2.5.1', 80),
    ('TRIBUTOS FEDERAIS', 'DARF', '2.5.3', 120),
    ('TRIBUTOS FEDERAIS', 'DARF IRPJ -LP', '2.5.3', 50),
    ('TRIBUTOS FEDERAIS', 'DARF CSOC', '2.5.3', 40),
    ('TRIBUTOS FEDERAIS', 'DARF PIS', '2.5.3', 30),
    ('TRIBUTOS FEDERAIS', 'DARF COFINS', '2.5.3', 30),
    
    -- EVENTOS E CONFRATERNIZAÇÕES
    ('AÇÕES PARA FUNCIONÁRIOS', NULL, '3.2.13', 60),
    ('Ação comemorativa', NULL, '3.2.13', 25),
    ('BRINDES/PRODUTOS', NULL, '3.2.13', 40),
    
    -- MARKETING
    ('MIDIA SOCIAL', 'ADYEN A SERVIÇO DO FACEBOOK', '3.3.1', 50),
    ('MODELOS/MANEQUINS/INFLUENCER', NULL, '3.3.1', 80),
    ('AGÊNCIA DE PUBLICIDADE E MKT', NULL, '3.3.8', 35),
    ('CONSULTORIA MARKETING', NULL, '3.3.6', 20),
    
    -- SALÁRIOS E RH
    ('SALARIOS', 'SALARIO', '3.2.1', 300),
    ('ADIANTAMENTO DE SALARIOS', NULL, '3.2.1', 120),
    ('13º SALARIO', '13 SALARIO', '3.2.7', 50),
    ('FÉRIAS', NULL, '3.2.8', 80),
    ('GUIA RESCISÓRIO', NULL, '3.2.9', 30),
    ('RESCISÃO', NULL, '3.2.9', 25),
    ('IMPOSTOS/TAXAS', 'FGTS', '3.2.4', 100),
    ('INSS', NULL, '3.2.5', 80),
    ('MEDICINA E SEGURANÇA OCUPACIONAL', 'DELTA SAUDE ASSESSORIA EM MEDICINA DO TRABALH', '3.2.5', 60),
    ('VALE TRANSPORTE', 'SPTRANS', '3.2.3', 90),
    ('VALE TRANSPORTE', 'VIA NOVA BENEFÍCIOS', '3.2.3', 45),
    ('VALE REFEIÇÃO/ALIMENTAÇÃO', NULL, '3.2.14', 70),
    ('SERVIÇOS DE TERCEIROS', 'PONTO MAIS', '3.2.14', 50),
    ('PLANO DE SAUDE', 'NOTREDAME INTERMEDICA SAUDE SA', '3.2.12.2', 40),
    ('BENEFICIOS/CESTAS', 'CVS COMERCIO DE ALIMENTOS', '3.2.12.1', 60),
    ('SINDICATO', NULL, '3.2.14', 20),
    
    -- UTILIDADES
    ('REDE ELETRICA', 'ENEL', '3.1.2', 70),
    ('TELEFONIA FIXA', 'GOTO - JIVE TELECOMUNICAÇÕES DO BRASIL LTDA', '3.1.5.1', 50),
    ('TELEFONIA FIXA', 'VIVO - TELEFONICA BRASIL S.A', '3.1.5.2', 30),
    
    -- MANUTENÇÃO
    ('MANUTENÇÃO EQUIPAMENTO ESCRITÓRIO/DEPÓSITO', NULL, '4.2.4', 40),
    ('REFORMA NOVO BARRACÃO', NULL, '4.2.7', 35),
    ('DIVERSOS', 'HIDROELETROTEC CONSTRUÇÃO CIVIL', '4.2.4', 20),
    
    -- SOFTWARE E TI
    ('SOFTWARE', 'ALLTOMATIZE SISTEMAS LTDA', '3.1.22', 80),
    ('SOFTWARE', 'LIVE SOFTWARE LTDA', '3.1.22', 50),
    ('SOFTWARE', 'LINX SISTEMAS E COSNULTORIA LTDA', '3.1.22', 45),
    ('INFORMATICA/REDE', NULL, '3.1.22', 30),
    
    -- FRETE E TRANSPORTE
    ('FRETES AGREGADOS', NULL, '2.4.2', 200),
    ('TRANSPORTADORA/VENDAS ONLINE', NULL, '2.4.1', 150),
    ('CORREIOS/VENDAS ONLINE', 'CORREIOS - SP', '2.4.3', 80),
    ('LOGÍSTICA', NULL, '2.4.1', 40),
    
    -- COMISSÕES
    ('COMISSAO', NULL, '2.6.1', 100),
    ('REPRESENTANTES', NULL, '2.6.1', 500),
    
    -- PRO LABORE E SÓCIOS
    ('PRO LABORE', 'AHMAD EL ASSAAD', '3.5.1', 60),
    ('RETIRADA AHMAD', 'AHMAD EL ASSAAD', '3.5.1', 30),
    
    -- CONTABILIDADE
    ('CONTABILIDADE EXTERNA', 'CONTABILIDADE FILADELFIA', '3.1.8.3', 25),
    
    -- SEGUROS
    ('SEGURO DE TRANSPORTE / OUTROS', NULL, '3.1.11', 30),
    ('SEGUROS', NULL, '3.1.12', 20),
    
    -- LOCAÇÕES E IMÓVEIS
    ('LOCAÇÃO', NULL, '4.2.7', 15),
    ('PORTA PALETES', 'ELEVA SISTEMAS DE ARMAZENAGEM', '4.2.7', 10),
    
    -- ATIVOS
    ('MANUTENÇÃO EQUIPAMENTO ESCRITÓRIO/DEPÓSITO', 'DECOOL CLIMATIZAÇÃO', '4.2.3', 15),
    ('EQUIPAMENTOS', NULL, '4.2.3', 20)
    
) AS exemplos(categoria, fornecedor, codigo, contagem)
WHERE EXISTS (SELECT 1 FROM trade_chart_of_accounts WHERE codigo_dre_gerencial = codigo)
ON CONFLICT (categoria_nome, fornecedor_nome, tipo_documento) 
DO UPDATE SET 
  times_used = account_classification_rules.times_used + EXCLUDED.times_used,
  confidence_score = 0.95,
  last_used_at = now();

-- 3. Adicionar comentário sobre a tabela
COMMENT ON TABLE ai_training_examples IS 'Exemplos de treinamento para classificação IA baseados no histórico do gerente financeiro';
COMMENT ON COLUMN ai_training_examples.codigo_dre IS 'Código DRE gerencial conforme planilha do gerente (ex: 3.2.1, 2.1.1)';
COMMENT ON COLUMN ai_training_examples.historico IS 'Descrição do lançamento original para matching';

-- 4. Criar função para sugerir classificação baseada em histórico
CREATE OR REPLACE FUNCTION suggest_classification_from_history(
  p_historico TEXT,
  p_fornecedor TEXT DEFAULT NULL
) RETURNS TABLE (
  codigo_dre TEXT,
  conta_nome TEXT,
  conta_id UUID,
  confianca NUMERIC,
  fonte TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Primeiro tenta match exato por fornecedor
  IF p_fornecedor IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      r.categoria_nome,
      t.name,
      t.id,
      r.confidence_score::NUMERIC,
      'regra_fornecedor'::TEXT
    FROM account_classification_rules r
    LEFT JOIN trade_chart_of_accounts t ON t.id = r.plano_contas_id
    WHERE r.fornecedor_nome ILIKE '%' || p_fornecedor || '%'
    LIMIT 1;
    
    IF FOUND THEN RETURN; END IF;
  END IF;
  
  -- Tenta match por categoria (primeira palavra do histórico)
  RETURN QUERY
  SELECT 
    r.categoria_nome,
    t.name,
    t.id,
    r.confidence_score::NUMERIC * 0.8,
    'regra_categoria'::TEXT
  FROM account_classification_rules r
  LEFT JOIN trade_chart_of_accounts t ON t.id = r.plano_contas_id
  WHERE r.categoria_nome ILIKE '%' || split_part(p_historico, ' ', 1) || '%'
     OR r.categoria_nome ILIKE '%' || split_part(p_historico, '-', 1) || '%'
  ORDER BY r.times_used DESC
  LIMIT 1;
  
  RETURN;
END;
$$;