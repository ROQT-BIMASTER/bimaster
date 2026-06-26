-- 1) Condição de pagamento no cabeçalho
ALTER TABLE public.erp_pedidos ADD COLUMN IF NOT EXISTS cond_pagto_id   integer;
ALTER TABLE public.erp_pedidos ADD COLUMN IF NOT EXISTS cond_pagto_desc text;

-- 2) Itens do pedido
CREATE TABLE IF NOT EXISTS public.erp_pedidos_item (
  id                bigint generated always as identity primary key,
  futura_item_id    integer not null unique,
  futura_pedido_id  integer not null,
  sequencia         integer,
  produto_futura_id integer,
  cod_produto       text,
  ean               text,
  descricao         text,
  quantidade        numeric(18,4),
  valor_unitario    numeric(18,5),
  desconto_valor    numeric(18,2),
  total_item        numeric(18,2),
  raw               jsonb,
  sincronizado_em   timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_erp_pedidos_item_pedido ON public.erp_pedidos_item(futura_pedido_id);
CREATE INDEX IF NOT EXISTS idx_erp_pedidos_item_cod    ON public.erp_pedidos_item(cod_produto);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_pedidos_item TO authenticated;
GRANT ALL ON public.erp_pedidos_item TO service_role;

ALTER TABLE public.erp_pedidos_item ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='erp_pedidos_item' AND policyname='erp_pedidos_item_select'
  ) THEN
    CREATE POLICY "erp_pedidos_item_select" ON public.erp_pedidos_item
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- 3) v_pedidos: DROP + CREATE (CREATE OR REPLACE não permite reordenar colunas)
-- ALLOW-DESTRUCTIVE: recriação da view v_pedidos para incluir cond_pagto_* na posição correta (BIM-pedidos-drilldown)
DROP VIEW IF EXISTS public.v_pedidos;

CREATE VIEW public.v_pedidos AS
SELECT
  p.futura_pedido_id, p.empresa_id, p.nro_pedido, p.tipo_pedido_id,
  p.data_emissao, p.data_movimentacao, p.data_previsao,
  p.cliente_futura_id, p.cliente_nome, p.cliente_cnpj_cpf,
  p.vendedor_futura_id, vd.id AS vendedor_id, vd.nome AS vendedor_nome,
  p.status, p.situacao_id, p.situacao_desc,
  p.cond_pagto_id, p.cond_pagto_desc,
  p.etapa, p.etapa_ordem, p.urgente, p.etapa_desde,
  ROUND(EXTRACT(EPOCH FROM (now() - p.etapa_desde)) / 86400.0, 2) AS dias_na_etapa,
  (p.etapa IN ('digitacao','aberto','separacao','separado','conferido')) AS em_andamento,
  p.total_produto, p.total_desconto, p.total_pedido,
  p.observacao, p.data_cancelamento, p.motivo_cancelamento,
  p.sincronizado_em
FROM public.erp_pedidos p
LEFT JOIN public.vendedores vd ON vd.futura_id = p.vendedor_futura_id;

GRANT SELECT ON public.v_pedidos TO authenticated;