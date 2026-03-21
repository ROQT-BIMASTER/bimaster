
-- Expansão da tabela contas_pagar com campos Omie
-- Identificação Omie
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS codigo_lancamento_omie BIGINT;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS codigo_lancamento_integracao VARCHAR(60);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS codigo_cliente_fornecedor BIGINT;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS codigo_cliente_fornecedor_integracao VARCHAR(60);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS data_previsao DATE;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS data_entrada DATE;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS numero_parcela_omie VARCHAR(7);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS total_parcelas_omie INTEGER;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS codigo_projeto INTEGER;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS codigo_vendedor INTEGER;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS numero_pedido VARCHAR(15);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS codigo_tipo_documento VARCHAR(5);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS chave_nfe VARCHAR(44);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS numero_documento_fiscal VARCHAR(20);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS id_conta_corrente BIGINT;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS id_origem VARCHAR(4);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS operacao VARCHAR(2);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS status_titulo VARCHAR(3);

-- Impostos retidos
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS valor_pis NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS retem_pis BOOLEAN DEFAULT false;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS valor_cofins NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS retem_cofins BOOLEAN DEFAULT false;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS valor_csll NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS retem_csll BOOLEAN DEFAULT false;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS valor_ir NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS retem_ir BOOLEAN DEFAULT false;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS valor_iss NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS retem_iss BOOLEAN DEFAULT false;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS valor_inss NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS retem_inss BOOLEAN DEFAULT false;

-- CNAB / Bancário
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS codigo_barras_ficha_compensacao VARCHAR(70);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS cnab_dados JSONB;

-- Rateios
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS rateio_categorias JSONB;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS rateio_departamentos JSONB;

-- Serviço tomado
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS servico_tomado JSONB;

-- Pagamento embutido / Controle
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS codigo_baixa_integracao VARCHAR(20);
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS bloquear_exclusao BOOLEAN DEFAULT false;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS baixar_documento BOOLEAN DEFAULT false;
ALTER TABLE public.contas_pagar ADD COLUMN IF NOT EXISTS conciliar_documento BOOLEAN DEFAULT false;

-- Unique index para upsert Omie-style
CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_pagar_empresa_cod_integracao
  ON public.contas_pagar (empresa_id, codigo_lancamento_integracao)
  WHERE codigo_lancamento_integracao IS NOT NULL;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_contas_pagar_codigo_lancamento_omie ON public.contas_pagar (codigo_lancamento_omie) WHERE codigo_lancamento_omie IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_chave_nfe ON public.contas_pagar (chave_nfe) WHERE chave_nfe IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contas_pagar_id_conta_corrente ON public.contas_pagar (id_conta_corrente) WHERE id_conta_corrente IS NOT NULL;
