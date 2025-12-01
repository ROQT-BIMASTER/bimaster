-- Adicionar novos campos de identificação do produto
ALTER TABLE fabrica_produtos
ADD COLUMN IF NOT EXISTS sku VARCHAR(100),
ADD COLUMN IF NOT EXISTS codigo_barras_ean VARCHAR(50),
ADD COLUMN IF NOT EXISTS codigo_legado VARCHAR(100),
ADD COLUMN IF NOT EXISTS descricao_completa TEXT,
ADD COLUMN IF NOT EXISTS descricao_curta VARCHAR(500),
ADD COLUMN IF NOT EXISTS nome_comercial VARCHAR(200),
ADD COLUMN IF NOT EXISTS categoria VARCHAR(100),
ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(100),
ADD COLUMN IF NOT EXISTS linha VARCHAR(100),
ADD COLUMN IF NOT EXISTS marca VARCHAR(100),
ADD COLUMN IF NOT EXISTS fabricante VARCHAR(200),
ADD COLUMN IF NOT EXISTS modelo VARCHAR(100),
ADD COLUMN IF NOT EXISTS versao_variacao VARCHAR(100),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'suspenso'));

-- Comentários para documentação
COMMENT ON COLUMN fabrica_produtos.sku IS 'SKU / Código do produto';
COMMENT ON COLUMN fabrica_produtos.codigo_barras_ean IS 'Código de barras EAN/GTIN';
COMMENT ON COLUMN fabrica_produtos.codigo_legado IS 'Código do sistema legado (ERP antigo)';
COMMENT ON COLUMN fabrica_produtos.descricao_completa IS 'Descrição detalhada do produto';
COMMENT ON COLUMN fabrica_produtos.descricao_curta IS 'Descrição resumida';
COMMENT ON COLUMN fabrica_produtos.nome_comercial IS 'Nome comercial usado em vendas';
COMMENT ON COLUMN fabrica_produtos.categoria IS 'Categoria principal do produto';
COMMENT ON COLUMN fabrica_produtos.subcategoria IS 'Subcategoria do produto';
COMMENT ON COLUMN fabrica_produtos.linha IS 'Linha de produtos';
COMMENT ON COLUMN fabrica_produtos.marca IS 'Marca do produto';
COMMENT ON COLUMN fabrica_produtos.fabricante IS 'Fabricante do produto';
COMMENT ON COLUMN fabrica_produtos.modelo IS 'Modelo do produto';
COMMENT ON COLUMN fabrica_produtos.versao_variacao IS 'Versão ou variação do produto';
COMMENT ON COLUMN fabrica_produtos.status IS 'Status do produto (ativo, inativo, suspenso)';

-- Índices para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_sku ON fabrica_produtos(sku);
CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_codigo_barras ON fabrica_produtos(codigo_barras_ean);
CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_categoria ON fabrica_produtos(categoria);
CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_marca ON fabrica_produtos(marca);
CREATE INDEX IF NOT EXISTS idx_fabrica_produtos_status ON fabrica_produtos(status);