CREATE TABLE IF NOT EXISTS public.cliente_financeiro (
  cliente_futura_id   integer PRIMARY KEY,
  cliente_nome        text,
  em_aberto           numeric(18,2) NOT NULL DEFAULT 0,
  vencido             numeric(18,2) NOT NULL DEFAULT 0,
  a_vencer            numeric(18,2) NOT NULL DEFAULT 0,
  n_parcelas_abertas  integer NOT NULL DEFAULT 0,
  n_parcelas_vencidas integer NOT NULL DEFAULT 0,
  n_pedidos_abertos   integer NOT NULL DEFAULT 0,
  n_titulos_abertos   integer NOT NULL DEFAULT 0,
  proximo_vencimento  date,
  maior_atraso_dias   integer NOT NULL DEFAULT 0,
  batch_ts            timestamptz,
  sincronizado_em     timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cliente_financeiro TO authenticated;
GRANT ALL    ON public.cliente_financeiro TO service_role;

ALTER TABLE public.cliente_financeiro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cliente_financeiro_select" ON public.cliente_financeiro;
CREATE POLICY "cliente_financeiro_select"
  ON public.cliente_financeiro
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS cliente_financeiro_vencido_idx
  ON public.cliente_financeiro (vencido DESC)
  WHERE vencido > 0;

CREATE INDEX IF NOT EXISTS cliente_financeiro_batch_ts_idx
  ON public.cliente_financeiro (batch_ts);

DROP TRIGGER IF EXISTS trg_cliente_financeiro_upd ON public.cliente_financeiro;
CREATE TRIGGER trg_cliente_financeiro_upd
  BEFORE UPDATE ON public.cliente_financeiro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();