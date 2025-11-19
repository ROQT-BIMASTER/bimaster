-- Adicionar campos faltantes do XML de NF-e na tabela fabrica_dados_fiscais_produto
-- Campos de código de barras e identificação
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS codigo_ean VARCHAR(14),
ADD COLUMN IF NOT EXISTS codigo_ean_tributavel VARCHAR(14),
ADD COLUMN IF NOT EXISTS codigo_enquadramento_ipi VARCHAR(10),
ADD COLUMN IF NOT EXISTS indicador_composicao_total INTEGER DEFAULT 1;

-- Campos de Substituição Tributária (ICMS-ST)
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS vbc_st_ret NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS percentual_st NUMERIC(5,4),
ADD COLUMN IF NOT EXISTS v_icms_substituto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS v_icms_st_ret NUMERIC(15,2);

-- Campos de PIS/COFINS por quantidade (além das alíquotas percentuais)
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS pis_qtd_bc_prod NUMERIC(15,4),
ADD COLUMN IF NOT EXISTS pis_v_aliq_prod NUMERIC(15,4),
ADD COLUMN IF NOT EXISTS cofins_qtd_bc_prod NUMERIC(15,4),
ADD COLUMN IF NOT EXISTS cofins_v_aliq_prod NUMERIC(15,4);

-- Campos adicionais de controle
ALTER TABLE fabrica_dados_fiscais_produto
ADD COLUMN IF NOT EXISTS informacoes_adicionais TEXT;

-- Comentários descritivos
COMMENT ON COLUMN fabrica_dados_fiscais_produto.codigo_ean IS 'Código de barras EAN principal do produto (GTIN)';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.codigo_ean_tributavel IS 'Código de barras EAN tributável (pode ser diferente do comercial)';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.codigo_enquadramento_ipi IS 'Código de enquadramento legal do IPI';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.indicador_composicao_total IS 'Indica se valor do item (vProd) entra no valor total da NF-e (vProd): 0=Não, 1=Sim';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.vbc_st_ret IS 'Valor da BC do ICMS ST retido';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.percentual_st IS 'Percentual de redução da BC do ICMS ST';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.v_icms_substituto IS 'Valor do ICMS substituto';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.v_icms_st_ret IS 'Valor do ICMS ST retido';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.pis_qtd_bc_prod IS 'Quantidade vendida para cálculo de PIS por quantidade';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.pis_v_aliq_prod IS 'Alíquota de PIS em reais por quantidade vendida';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.cofins_qtd_bc_prod IS 'Quantidade vendida para cálculo de COFINS por quantidade';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.cofins_v_aliq_prod IS 'Alíquota de COFINS em reais por quantidade vendida';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.informacoes_adicionais IS 'Informações adicionais do produto (campo infAdProd do XML)';