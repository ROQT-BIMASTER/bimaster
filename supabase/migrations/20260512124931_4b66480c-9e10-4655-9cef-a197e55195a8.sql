ALTER TABLE public.china_produto_submissoes
  ADD COLUMN IF NOT EXISTS data_envio timestamptz;

CREATE INDEX IF NOT EXISTS idx_china_produto_submissoes_status_data_envio
  ON public.china_produto_submissoes (status, data_envio DESC);