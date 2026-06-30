
-- ============ FATO: cabeçalho do pedido (Result) ============
CREATE TABLE IF NOT EXISTS public.erp_pedidos_rubysp (
  id                  bigint generated always as identity primary key,
  rubysp_pedido_id    bigint  not null unique,
  empresa_id          smallint,
  data_pedido         timestamptz,
  digitacao_inicio    timestamptz,
  digitacao_fim       timestamptz,
  status              text,
  operacao_id         integer,
  operacao_desc       text,
  bonificacao         boolean not null default false,
  romaneio_id         bigint,
  pedido_venda_relacionado bigint,
  cliente_id          bigint,
  cliente_nome        text,
  cliente_cnpj        text,
  cliente_cidade      text,
  cliente_uf          text,
  cond_pagamento_id   integer,
  cond_pagamento_desc text,
  endereco_logradouro text,
  endereco_numero     text,
  endereco_bairro     text,
  endereco_cep        text,
  endereco_entrega    text,
  vendedor_id         integer,
  vendedor_nome       text,
  total_pedido        numeric(18,2),
  nf_numero           bigint,
  data_entrega        timestamptz,
  motivo_cancelamento text,
  etapa               text not null,
  etapa_ordem         smallint,
  finalizado          boolean not null default false,
  etapa_desde         timestamptz,
  ts_liberacao        timestamptz, usuario_liberacao   text,
  ts_separacao        timestamptz, usuario_separacao   text,
  ts_conferencia      timestamptz, usuario_conferencia text,
  ts_expedicao        timestamptz, usuario_expedicao   text,
  ts_faturamento      timestamptz, usuario_faturamento text,
  ts_boleto           timestamptz, usuario_boleto      text,
  ts_entrega          timestamptz,
  entrega_local       text,
  entrega_obs         text,
  tem_canhoto         boolean not null default false,
  tempo_digitacao_lib_min     integer,
  tempo_aguard_separacao_min  integer,
  tempo_separacao_min         integer,
  tempo_aguard_expedicao_min  integer,
  tempo_faturamento_min       integer,
  tempo_entrega_min           integer,
  lead_time_min               integer,
  lead_time_entrega_min       integer,
  raw                 jsonb,
  sincronizado_em     timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_erp_ped_rsp_etapa ON public.erp_pedidos_rubysp(etapa);
CREATE INDEX IF NOT EXISTS idx_erp_ped_rsp_data  ON public.erp_pedidos_rubysp(data_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_erp_ped_rsp_andam ON public.erp_pedidos_rubysp(finalizado) WHERE finalizado = false;

GRANT SELECT ON public.erp_pedidos_rubysp TO authenticated;
GRANT ALL    ON public.erp_pedidos_rubysp TO service_role;

ALTER TABLE public.erp_pedidos_rubysp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsp_ped_sel" ON public.erp_pedidos_rubysp FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_erp_ped_rsp_updated ON public.erp_pedidos_rubysp;
CREATE TRIGGER trg_erp_ped_rsp_updated BEFORE UPDATE ON public.erp_pedidos_rubysp
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ITENS do pedido (drill-down) ============
CREATE TABLE IF NOT EXISTS public.erp_pedido_itens_rubysp (
  id                bigint generated always as identity primary key,
  rubysp_pedido_id  bigint not null references public.erp_pedidos_rubysp(rubysp_pedido_id) on delete cascade,
  sequencia         integer,
  produto_id        bigint,
  descricao         text,
  ean               text,
  unidade           text,
  quantidade        numeric(18,3),
  preco             numeric(18,2),
  desconto          numeric(18,2),
  total_item        numeric(18,2),
  created_at        timestamptz not null default now(),
  unique (rubysp_pedido_id, sequencia)
);

CREATE INDEX IF NOT EXISTS idx_erp_ped_itens_rsp_ped ON public.erp_pedido_itens_rubysp(rubysp_pedido_id);

GRANT SELECT ON public.erp_pedido_itens_rubysp TO authenticated;
GRANT ALL    ON public.erp_pedido_itens_rubysp TO service_role;

ALTER TABLE public.erp_pedido_itens_rubysp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsp_itens_sel" ON public.erp_pedido_itens_rubysp FOR SELECT TO authenticated USING (true);

-- ============ log de sincronização ============
CREATE TABLE IF NOT EXISTS public.sync_log_rubysp (
  id           bigint generated always as identity primary key,
  origem       text not null default 'pedidos',
  periodo_de   date,
  periodo_ate  date,
  pedidos_qtd  integer,
  itens_qtd    integer,
  ok           boolean not null default true,
  detalhe      text,
  created_at   timestamptz not null default now()
);

GRANT SELECT ON public.sync_log_rubysp TO authenticated;
GRANT ALL    ON public.sync_log_rubysp TO service_role;

ALTER TABLE public.sync_log_rubysp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsp_log_sel" ON public.sync_log_rubysp FOR SELECT TO authenticated USING (true);

-- ============ VIEW 1: kanban (em andamento) ============
CREATE OR REPLACE VIEW public.vw_pedidos_kanban_rubysp AS
SELECT p.*,
  CASE WHEN p.finalizado THEN NULL
       ELSE floor(extract(epoch FROM (now() - coalesce(p.etapa_desde, p.data_pedido))) / 60)::int
  END AS idade_etapa_min
FROM public.erp_pedidos_rubysp p
WHERE p.finalizado = false AND p.etapa <> 'cancelado';

GRANT SELECT ON public.vw_pedidos_kanban_rubysp TO authenticated;

-- ============ VIEW 2: tempo médio/mediano por etapa (30d) ============
CREATE OR REPLACE VIEW public.vw_lead_time_etapas_rubysp AS
SELECT
  count(*) FILTER (WHERE tempo_digitacao_lib_min IS NOT NULL) AS n_liberacao,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY tempo_digitacao_lib_min)    AS p50_ate_liberacao_min,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY tempo_aguard_separacao_min) AS p50_aguard_separacao_min,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY tempo_separacao_min)        AS p50_separacao_min,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY tempo_aguard_expedicao_min) AS p50_aguard_expedicao_min,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY tempo_faturamento_min)      AS p50_faturamento_min,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY tempo_entrega_min)          AS p50_entrega_transito_min,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY lead_time_min)              AS p50_lead_time_min,
  avg(lead_time_min)::int                                                 AS media_lead_time_min,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY lead_time_entrega_min)      AS p50_lead_time_entrega_min,
  avg(lead_time_entrega_min)::int                                         AS media_lead_time_entrega_min
FROM public.erp_pedidos_rubysp
WHERE data_pedido >= now() - interval '30 days';

GRANT SELECT ON public.vw_lead_time_etapas_rubysp TO authenticated;
