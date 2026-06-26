-- Painel de Pedidos em Andamento (ERP Futura)
CREATE TABLE IF NOT EXISTS public.erp_pedidos (
  id                  bigint generated always as identity primary key,
  futura_pedido_id    integer not null unique,
  empresa_id          smallint,
  nro_pedido          text,
  tipo_pedido_id      integer,
  data_emissao        date,
  data_movimentacao   date,
  data_previsao       date,
  cliente_futura_id   integer,
  cliente_nome        text,
  cliente_cnpj_cpf    text,
  vendedor_futura_id  integer,
  status              smallint,
  situacao_id         integer,
  situacao_desc       text,
  etapa               text not null,
  etapa_ordem         smallint,
  urgente             boolean not null default false,
  etapa_desde         timestamptz,
  total_produto       numeric(18,2),
  total_desconto      numeric(18,2),
  total_pedido        numeric(18,2),
  observacao          text,
  data_cancelamento   timestamptz,
  motivo_cancelamento text,
  raw                 jsonb,
  sincronizado_em     timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_pedidos TO authenticated;
GRANT ALL ON public.erp_pedidos TO service_role;

CREATE INDEX IF NOT EXISTS idx_erp_pedidos_etapa    ON public.erp_pedidos(etapa);
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_data     ON public.erp_pedidos(data_emissao DESC);
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_vendedor ON public.erp_pedidos(vendedor_futura_id);
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_cliente  ON public.erp_pedidos(cliente_futura_id);
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_status   ON public.erp_pedidos(status);

CREATE TABLE IF NOT EXISTS public.erp_pedidos_etapa_log (
  id               bigint generated always as identity primary key,
  futura_pedido_id integer not null,
  etapa_anterior   text,
  etapa_nova       text not null,
  mudou_em         timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_pedidos_etapa_log TO authenticated;
GRANT ALL ON public.erp_pedidos_etapa_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_erp_pedidos_etapa_log_ped
  ON public.erp_pedidos_etapa_log(futura_pedido_id, mudou_em DESC);

CREATE TABLE IF NOT EXISTS public.erp_pedidos_sync_log (
  id                bigint generated always as identity primary key,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  tipo              text,
  periodo_de        date,
  periodo_ate       date,
  pedidos_recebidos int,
  pedidos_upserted  int,
  status            text not null default 'em_andamento' CHECK (status IN ('em_andamento','ok','erro')),
  erro              text,
  created_at        timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_pedidos_sync_log TO authenticated;
GRANT ALL ON public.erp_pedidos_sync_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_erp_pedidos_sync_started
  ON public.erp_pedidos_sync_log(started_at DESC);

-- Trigger: rastreia mudança de etapa
CREATE OR REPLACE FUNCTION public.erp_pedidos_track_etapa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.etapa_desde := COALESCE(NEW.etapa_desde, now());
    RETURN NEW;
  END IF;
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    NEW.etapa_desde := now();
    INSERT INTO public.erp_pedidos_etapa_log(futura_pedido_id, etapa_anterior, etapa_nova, mudou_em)
    VALUES (NEW.futura_pedido_id, OLD.etapa, NEW.etapa, now());
  ELSE
    NEW.etapa_desde := OLD.etapa_desde;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_erp_pedidos_track_etapa ON public.erp_pedidos;
CREATE TRIGGER trg_erp_pedidos_track_etapa
  BEFORE INSERT OR UPDATE ON public.erp_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.erp_pedidos_track_etapa();

DROP TRIGGER IF EXISTS trg_erp_pedidos_updated ON public.erp_pedidos;
CREATE TRIGGER trg_erp_pedidos_updated
  BEFORE UPDATE ON public.erp_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.erp_pedidos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_pedidos_etapa_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_pedidos_sync_log  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "erp_pedidos_select"       ON public.erp_pedidos;
DROP POLICY IF EXISTS "erp_pedidos_etapalog_sel" ON public.erp_pedidos_etapa_log;
DROP POLICY IF EXISTS "erp_pedidos_synclog_sel"  ON public.erp_pedidos_sync_log;

CREATE POLICY "erp_pedidos_select"       ON public.erp_pedidos           FOR SELECT TO authenticated USING (true);
CREATE POLICY "erp_pedidos_etapalog_sel" ON public.erp_pedidos_etapa_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "erp_pedidos_synclog_sel"  ON public.erp_pedidos_sync_log  FOR SELECT TO authenticated USING (true);

-- View enriquecida
CREATE OR REPLACE VIEW public.v_pedidos AS
SELECT
  p.futura_pedido_id, p.empresa_id, p.nro_pedido, p.tipo_pedido_id,
  p.data_emissao, p.data_movimentacao, p.data_previsao,
  p.cliente_futura_id, p.cliente_nome, p.cliente_cnpj_cpf,
  p.vendedor_futura_id,
  vd.id   AS vendedor_id,
  vd.nome AS vendedor_nome,
  p.status, p.situacao_id, p.situacao_desc,
  p.etapa, p.etapa_ordem, p.urgente, p.etapa_desde,
  ROUND(EXTRACT(EPOCH FROM (now() - p.etapa_desde))::numeric / 86400.0, 2) AS dias_na_etapa,
  (p.etapa IN ('digitacao','aberto','separacao','separado','conferido')) AS em_andamento,
  p.total_produto, p.total_desconto, p.total_pedido,
  p.observacao, p.data_cancelamento, p.motivo_cancelamento,
  p.sincronizado_em
FROM public.erp_pedidos p
LEFT JOIN public.vendedores vd ON vd.futura_id = p.vendedor_futura_id;

GRANT SELECT ON public.v_pedidos TO authenticated;
GRANT SELECT ON public.v_pedidos TO service_role;

COMMENT ON VIEW public.v_pedidos IS
  'Pedidos de venda da Futura com etapa canônica, tempo na etapa (dias_na_etapa) e vendedor. Base do painel de pedidos em andamento.';
