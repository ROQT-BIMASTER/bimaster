-- 1) Tabela de estoque do fornecedor
CREATE TABLE IF NOT EXISTS public.fornecedor_estoque_futura (
  id                       bigint generated always as identity primary key,
  erp_id                   text not null unique,
  empresa_id               int  not null,
  empresa_nome             text,
  ean_caixa                text,
  codigo_produto           text not null,
  descricao                text,
  estoque_caixas           numeric(18,4) not null default 0,
  unidade                  text,
  status                   text,
  data_atualizacao_origem  timestamptz,
  raw                      jsonb,
  sincronizado_em          timestamptz not null default now(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint uq_fornecedor_estoque_empresa_produto unique (empresa_id, codigo_produto)
);

CREATE INDEX IF NOT EXISTS idx_fornec_estoque_ean ON public.fornecedor_estoque_futura(ean_caixa) WHERE ean_caixa <> '';
CREATE INDEX IF NOT EXISTS idx_fornec_estoque_empresa ON public.fornecedor_estoque_futura(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornec_estoque_sync ON public.fornecedor_estoque_futura(sincronizado_em DESC);

COMMENT ON TABLE public.fornecedor_estoque_futura IS
  'Estoque do fornecedor (Sistema Futura/terceiro), recebido via conector externo. Saldo em caixas (CX).';

GRANT SELECT ON public.fornecedor_estoque_futura TO authenticated;
GRANT ALL ON public.fornecedor_estoque_futura TO service_role;

ALTER TABLE public.fornecedor_estoque_futura ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornec_estoque_leitura" ON public.fornecedor_estoque_futura
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fornec_estoque_sem_escrita_cliente" ON public.fornecedor_estoque_futura
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DROP TRIGGER IF EXISTS trg_fornec_estoque_updated ON public.fornecedor_estoque_futura;
CREATE TRIGGER trg_fornec_estoque_updated
  BEFORE UPDATE ON public.fornecedor_estoque_futura
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Log de sincronização
CREATE TABLE IF NOT EXISTS public.fornecedor_estoque_sync_log (
  id                bigint generated always as identity primary key,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz,
  tipo              text,
  linhas_recebidas  int,
  linhas_upserted   int,
  status            text not null default 'em_andamento' CHECK (status IN ('em_andamento','ok','erro')),
  erro              text,
  created_at        timestamptz not null default now()
);

GRANT SELECT ON public.fornecedor_estoque_sync_log TO authenticated;
GRANT ALL ON public.fornecedor_estoque_sync_log TO service_role;

ALTER TABLE public.fornecedor_estoque_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornec_sync_log_leitura" ON public.fornecedor_estoque_sync_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "fornec_sync_log_sem_escrita_cliente" ON public.fornecedor_estoque_sync_log
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 3) View integrada (security_invoker para respeitar RLS das tabelas-base)
CREATE OR REPLACE VIEW public.v_estoque_fornecedor_integrado
WITH (security_invoker = on) AS
SELECT
  ef.empresa_id, ef.empresa_nome,
  ef.ean_caixa,
  ef.codigo_produto        AS futura_codigo,
  ef.descricao             AS futura_descricao,
  ef.estoque_caixas        AS fornecedor_caixas,
  ef.status                AS futura_status,
  ef.data_atualizacao_origem,
  ef.sincronizado_em,
  fp.id                    AS produto_id,
  fp.codigo                AS nosso_codigo,
  fp.sku,
  fp.nome_comercial,
  ns.nosso_saldo_un,
  ns.nosso_saldo_cx,
  (fp.id IS NOT NULL)      AS casado
FROM public.fornecedor_estoque_futura ef
LEFT JOIN public.fabrica_produtos fp
  ON fp.codigo_barras_ean = ef.ean_caixa AND COALESCE(ef.ean_caixa,'') <> ''
LEFT JOIN (
  SELECT produto_raiz::text AS produto_raiz_txt,
         SUM(saldo_total_em_unidades) AS nosso_saldo_un,
         SUM(saldo_em_caixas)         AS nosso_saldo_cx
  FROM public.estoque_unificado_cache
  GROUP BY produto_raiz
) ns ON ns.produto_raiz_txt = fp.codigo::text;

COMMENT ON VIEW public.v_estoque_fornecedor_integrado IS
  'Estoque do fornecedor (Futura) casado com fabrica_produtos por EAN da caixa; casado=false = produto sem match no catálogo.';

GRANT SELECT ON public.v_estoque_fornecedor_integrado TO authenticated;