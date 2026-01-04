-- Adicionar campo categoria_dre na tabela trade_chart_of_accounts
ALTER TABLE trade_chart_of_accounts 
ADD COLUMN IF NOT EXISTS categoria_dre VARCHAR(50) DEFAULT NULL;

-- Comentário explicando os valores possíveis
COMMENT ON COLUMN trade_chart_of_accounts.categoria_dre IS 'Categoria para DRE: receita_bruta, deducoes, custo_vendas, despesas_fixas, impostos_lucro';