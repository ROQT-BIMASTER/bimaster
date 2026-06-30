
CREATE TABLE IF NOT EXISTS public.erp_cliente_compras_mensal_rubysp (
  id              bigint generated always as identity primary key,
  cliente_id      bigint not null,
  ano_mes         char(7) not null,
  faturamento     numeric(18,2) not null default 0,
  quantidade      numeric(18,3) not null default 0,
  n_pedidos       integer not null default 0,
  sincronizado_em timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (cliente_id, ano_mes)
);

CREATE INDEX IF NOT EXISTS idx_compras_mensal_rsp_cli
  ON public.erp_cliente_compras_mensal_rubysp(cliente_id, ano_mes);

GRANT SELECT ON public.erp_cliente_compras_mensal_rubysp TO authenticated;
GRANT ALL ON public.erp_cliente_compras_mensal_rubysp TO service_role;

ALTER TABLE public.erp_cliente_compras_mensal_rubysp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "compras_mensal_rsp_sel" ON public.erp_cliente_compras_mensal_rubysp;
CREATE POLICY "compras_mensal_rsp_sel" ON public.erp_cliente_compras_mensal_rubysp
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_compras_mensal_rsp_upd ON public.erp_cliente_compras_mensal_rubysp;
CREATE TRIGGER trg_compras_mensal_rsp_upd
  BEFORE UPDATE ON public.erp_cliente_compras_mensal_rubysp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.serie_mensal_cliente_rubysp(p_cliente_id bigint)
RETURNS TABLE (ano_mes char(7), faturamento numeric, quantidade numeric, n_pedidos integer)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ano_mes, faturamento, quantidade, n_pedidos
  FROM public.erp_cliente_compras_mensal_rubysp
  WHERE cliente_id = p_cliente_id
  ORDER BY ano_mes
$$;

GRANT EXECUTE ON FUNCTION public.serie_mensal_cliente_rubysp(bigint) TO authenticated;
