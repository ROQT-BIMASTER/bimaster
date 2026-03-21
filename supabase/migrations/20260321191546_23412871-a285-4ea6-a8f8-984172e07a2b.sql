
-- Expand lancamentos_conta_corrente with Omie-compatible fields
ALTER TABLE public.lancamentos_conta_corrente
  ADD COLUMN IF NOT EXISTS n_cod_lanc BIGINT,
  ADD COLUMN IF NOT EXISTS c_cod_int_lanc VARCHAR(20),
  ADD COLUMN IF NOT EXISTS n_cod_agrup BIGINT,
  ADD COLUMN IF NOT EXISTS c_tipo_documento VARCHAR(5),
  ADD COLUMN IF NOT EXISTS n_cod_cliente BIGINT,
  ADD COLUMN IF NOT EXISTS n_cod_projeto INTEGER,
  ADD COLUMN IF NOT EXISTS n_cod_vendedor INTEGER,
  ADD COLUMN IF NOT EXISTS n_cod_comprador INTEGER,
  ADD COLUMN IF NOT EXISTS c_natureza VARCHAR(1),
  ADD COLUMN IF NOT EXISTS c_origem_lanc VARCHAR(4),
  ADD COLUMN IF NOT EXISTS data_conciliacao DATE,
  ADD COLUMN IF NOT EXISTS hora_conciliacao TIME,
  ADD COLUMN IF NOT EXISTS usuario_conciliacao VARCHAR(10),
  ADD COLUMN IF NOT EXISTS c_ident_lanc VARCHAR(40),
  ADD COLUMN IF NOT EXISTS n_cod_lanc_cp BIGINT,
  ADD COLUMN IF NOT EXISTS n_cod_lanc_cr BIGINT,
  ADD COLUMN IF NOT EXISTS conta_destino_n_cod_cc BIGINT,
  ADD COLUMN IF NOT EXISTS importado_api BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rateio_categorias JSONB,
  ADD COLUMN IF NOT EXISTS rateio_departamentos JSONB;

-- Add comments
COMMENT ON COLUMN public.lancamentos_conta_corrente.n_cod_lanc IS 'Código do lançamento no Omie';
COMMENT ON COLUMN public.lancamentos_conta_corrente.c_cod_int_lanc IS 'Código de integração do lançamento (parceiro)';
COMMENT ON COLUMN public.lancamentos_conta_corrente.n_cod_agrup IS 'Código de agrupamento do lançamento';
COMMENT ON COLUMN public.lancamentos_conta_corrente.c_tipo_documento IS 'Tipo de documento: DIN, CHQ, DOC, TED, PIX, etc.';
COMMENT ON COLUMN public.lancamentos_conta_corrente.n_cod_cliente IS 'Código do cliente/favorecido no Omie';
COMMENT ON COLUMN public.lancamentos_conta_corrente.n_cod_projeto IS 'Código do projeto vinculado';
COMMENT ON COLUMN public.lancamentos_conta_corrente.n_cod_vendedor IS 'Código do vendedor vinculado';
COMMENT ON COLUMN public.lancamentos_conta_corrente.n_cod_comprador IS 'Código do comprador vinculado';
COMMENT ON COLUMN public.lancamentos_conta_corrente.c_natureza IS 'Natureza do lançamento: C (Crédito) ou D (Débito)';
COMMENT ON COLUMN public.lancamentos_conta_corrente.c_origem_lanc IS 'Origem Omie: MANU, CONP, CONR, TRAN, DEVO, AJUR, etc.';
COMMENT ON COLUMN public.lancamentos_conta_corrente.data_conciliacao IS 'Data da conciliação bancária';
COMMENT ON COLUMN public.lancamentos_conta_corrente.hora_conciliacao IS 'Hora da conciliação bancária';
COMMENT ON COLUMN public.lancamentos_conta_corrente.usuario_conciliacao IS 'Usuário responsável pela conciliação';
COMMENT ON COLUMN public.lancamentos_conta_corrente.c_ident_lanc IS 'Identificação do lançamento no extrato importado';
COMMENT ON COLUMN public.lancamentos_conta_corrente.n_cod_lanc_cp IS 'Código do lançamento de Contas a Pagar vinculado';
COMMENT ON COLUMN public.lancamentos_conta_corrente.n_cod_lanc_cr IS 'Código do lançamento de Contas a Receber vinculado';
COMMENT ON COLUMN public.lancamentos_conta_corrente.conta_destino_n_cod_cc IS 'Código numérico da conta corrente de destino (transferência)';
COMMENT ON COLUMN public.lancamentos_conta_corrente.importado_api IS 'Indica se o registro foi importado pela API';
COMMENT ON COLUMN public.lancamentos_conta_corrente.bloqueado IS 'Indica se o registro está bloqueado pela API';
COMMENT ON COLUMN public.lancamentos_conta_corrente.rateio_categorias IS 'Array JSON de rateio por categorias [{cCodCateg, nValor, nPerc}]';
COMMENT ON COLUMN public.lancamentos_conta_corrente.rateio_departamentos IS 'Array JSON de rateio por departamentos [{cCodDep, nValDep, nPerDep}]';

-- Unique constraint for upsert by integration code
CREATE UNIQUE INDEX IF NOT EXISTS idx_lancamentos_cc_empresa_cod_int
  ON public.lancamentos_conta_corrente (empresa_id, c_cod_int_lanc)
  WHERE c_cod_int_lanc IS NOT NULL;

-- Index for Omie numeric code lookups
CREATE INDEX IF NOT EXISTS idx_lancamentos_cc_n_cod_lanc
  ON public.lancamentos_conta_corrente (n_cod_lanc)
  WHERE n_cod_lanc IS NOT NULL;
