
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS plano_contas_id_padrao uuid REFERENCES public.trade_chart_of_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS categoria_codigo_padrao text,
  ADD COLUMN IF NOT EXISTS plano_padrao_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS plano_padrao_atualizado_por uuid;

CREATE INDEX IF NOT EXISTS idx_fornecedores_codigo_externo_plano_padrao
  ON public.fornecedores (codigo_externo)
  WHERE plano_contas_id_padrao IS NOT NULL;
