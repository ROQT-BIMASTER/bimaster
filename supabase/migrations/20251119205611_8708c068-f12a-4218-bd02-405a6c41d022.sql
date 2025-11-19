-- Criar tabela para dados fiscais dos produtos
CREATE TABLE IF NOT EXISTS fabrica_dados_fiscais_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES fabrica_materias_primas(id) ON DELETE CASCADE,
  
  -- Classificação fiscal
  ncm VARCHAR(10),
  cest VARCHAR(10),
  origem_mercadoria VARCHAR(2),
  classificacao_fiscal VARCHAR(100),
  classificacao_pis_cofins VARCHAR(50),
  cstp_pis VARCHAR(10),
  cod_nbm VARCHAR(20),
  excecao_ncm VARCHAR(20),
  
  -- CFOP e operações
  cfop_padrao VARCHAR(10),
  
  -- Impostos
  aliquota_icms NUMERIC(5,2),
  aliquota_ipi NUMERIC(5,2),
  aliquota_pis NUMERIC(5,2),
  aliquota_cofins NUMERIC(5,2),
  cst_icms VARCHAR(10),
  cst_ipi VARCHAR(10),
  cst_pis VARCHAR(10),
  cst_cofins VARCHAR(10),
  
  -- Preços e custos
  preco_custo NUMERIC(15,2),
  preco_venda NUMERIC(15,2),
  preco_maximo NUMERIC(15,2),
  preco_fabrica NUMERIC(15,2),
  custo_medio NUMERIC(15,2),
  custo_icms NUMERIC(15,2),
  custo_icms_percentual NUMERIC(5,2),
  
  -- Margens e descontos
  markup_percentual NUMERIC(5,2),
  desconto_maximo NUMERIC(5,2),
  desconto_entrada NUMERIC(5,2),
  desconto_compra NUMERIC(5,2),
  comissao_venda NUMERIC(5,2),
  comissao_cobranca NUMERIC(5,2),
  
  -- Estoque e quantidades
  estoque_minimo NUMERIC(15,2),
  estoque_maximo NUMERIC(15,2),
  reserva NUMERIC(15,2),
  qtd_minima NUMERIC(15,2),
  qtd_maxima NUMERIC(15,2),
  qtd_max_dia_vendedor NUMERIC(15,2),
  qtd_max_dia_cliente NUMERIC(15,2),
  
  -- Pesos e medidas
  peso_bruto NUMERIC(15,3),
  peso_liquido NUMERIC(15,3),
  
  -- Curvas e classificações
  curva_fisica VARCHAR(1),
  curva_monetaria VARCHAR(1),
  
  -- Compra e venda
  caixa_padrao_compra NUMERIC(15,2),
  unidade_compra VARCHAR(10),
  unidade_venda VARCHAR(10),
  
  -- Outros
  frete NUMERIC(15,2),
  repasse_icm NUMERIC(5,2),
  substancia VARCHAR(200),
  observacoes TEXT,
  
  -- Controle
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  created_by UUID,
  
  -- Garantir apenas um registro fiscal por produto
  UNIQUE(produto_id)
);

-- Comentários para documentação
COMMENT ON TABLE fabrica_dados_fiscais_produto IS 'Armazena informações fiscais e tributárias dos produtos para registro e documentação';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.ncm IS 'Nomenclatura Comum do Mercosul - código de 8 dígitos';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.cest IS 'Código Especificador da Substituição Tributária';
COMMENT ON COLUMN fabrica_dados_fiscais_produto.origem_mercadoria IS 'Origem da mercadoria (0-Nacional, 1-Estrangeira importação direta, etc)';

-- Habilitar RLS
ALTER TABLE fabrica_dados_fiscais_produto ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários com permissão fabrica podem ver dados fiscais"
ON fabrica_dados_fiscais_produto
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM usuario_permissoes_modulos upm
    JOIN modulos_sistema ms ON ms.id = upm.modulo_id
    WHERE ms.codigo = 'fabrica'
    AND upm.usuario_id = auth.uid()
  )
);

CREATE POLICY "Admins e supervisores podem gerenciar dados fiscais"
ON fabrica_dados_fiscais_produto
FOR ALL
USING (is_admin_or_supervisor(auth.uid()))
WITH CHECK (is_admin_or_supervisor(auth.uid()));

-- Índices para performance
CREATE INDEX idx_dados_fiscais_produto_id ON fabrica_dados_fiscais_produto(produto_id);
CREATE INDEX idx_dados_fiscais_ncm ON fabrica_dados_fiscais_produto(ncm);
CREATE INDEX idx_dados_fiscais_cfop ON fabrica_dados_fiscais_produto(cfop_padrao);