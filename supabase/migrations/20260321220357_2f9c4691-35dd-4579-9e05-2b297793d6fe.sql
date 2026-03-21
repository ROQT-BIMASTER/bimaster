
ALTER TABLE public.trade_chart_of_accounts
  ADD COLUMN IF NOT EXISTS descricao_padrao varchar(50),
  ADD COLUMN IF NOT EXISTS tipo_categoria varchar(3),
  ADD COLUMN IF NOT EXISTS definida_pelo_usuario varchar(1) DEFAULT 'S',
  ADD COLUMN IF NOT EXISTS id_conta_contabil integer,
  ADD COLUMN IF NOT EXISTS tag_conta_contabil varchar(20),
  ADD COLUMN IF NOT EXISTS nao_exibir varchar(1) DEFAULT 'N',
  ADD COLUMN IF NOT EXISTS transferencia varchar(1) DEFAULT 'N',
  ADD COLUMN IF NOT EXISTS codigo_dre varchar(10),
  ADD COLUMN IF NOT EXISTS codigo_integracao varchar(20) UNIQUE;
