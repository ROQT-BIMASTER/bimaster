
-- 1) Novas colunas no cache
ALTER TABLE public.estoque_unificado_cache
  ADD COLUMN IF NOT EXISTS bloqueado_total_em_unidades numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disponivel_total_em_unidades numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pendente_total_em_unidades numeric NOT NULL DEFAULT 0;

-- 2) Recria função de refresh incluindo bloqueado/disponivel/pendente
CREATE OR REPLACE FUNCTION public.refresh_estoque_unificado_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  TRUNCATE public.estoque_unificado_cache;

  WITH RECURSIVE fator_desc AS (
    SELECT DISTINCT b.filho_cod AS sku, 1::numeric AS fator
    FROM public.bom_edges b
    WHERE b.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM public.bom_edges b2
        WHERE b2.ativo = true AND b2.pai_cod = b.filho_cod
      )
    UNION ALL
    SELECT b.pai_cod, (b.quantidade * fd.fator)::numeric
    FROM public.bom_edges b
    JOIN fator_desc fd ON fd.sku = b.filho_cod
    WHERE b.ativo = true
  ),
  fator_por_sku AS (
    SELECT sku, MAX(fator)::numeric AS fator_un
    FROM fator_desc
    GROUP BY sku
  ),
  estoque AS (
    SELECT e.empresa_par AS empresa,
           e.cod_produto,
           SUM(COALESCE(e.saldo, 0))                     AS saldo_total,
           SUM(COALESCE(e.estoque_bloqueado_produto, 0)) AS bloqueado_total,
           SUM(COALESCE(e.pedido_pendente, 0))           AS pendente_total,
           SUM(COALESCE(e.custo_total, 0))               AS custo_total
    FROM public.erp_estoque_distribuidora e
    WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
    GROUP BY e.empresa_par, e.cod_produto
  ),
  classificado AS (
    SELECT es.empresa, es.cod_produto,
           es.saldo_total,
           es.bloqueado_total,
           es.pendente_total,
           GREATEST(es.saldo_total - es.bloqueado_total, 0) AS disponivel_total,
           es.custo_total,
           n.nivel,
           COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz,
           COALESCE(fps.fator_un, 1)::numeric AS fator_un
    FROM estoque es
    LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
    LEFT JOIN fator_por_sku fps ON fps.sku = es.cod_produto
  ),
  agg AS (
    SELECT c.empresa,
           c.produto_raiz,
           SUM(CASE WHEN c.nivel = 1 THEN c.saldo_total ELSE 0 END) AS saldo_em_caixas,
           SUM(CASE WHEN c.nivel = 2 THEN c.saldo_total ELSE 0 END) AS saldo_em_displays,
           SUM(CASE WHEN c.nivel = 3 THEN c.saldo_total ELSE 0 END) AS saldo_em_unidades,
           COALESCE(SUM(c.saldo_total      * c.fator_un), 0) AS saldo_total_em_unidades,
           COALESCE(SUM(c.bloqueado_total  * c.fator_un), 0) AS bloqueado_total_em_unidades,
           COALESCE(SUM(c.disponivel_total * c.fator_un), 0) AS disponivel_total_em_unidades,
           COALESCE(SUM(c.pendente_total   * c.fator_un), 0) AS pendente_total_em_unidades,
           SUM(c.custo_total) AS custo_total,
           COUNT(DISTINCT c.cod_produto)::int AS skus_envolvidos
    FROM classificado c
    GROUP BY c.empresa, c.produto_raiz
  ),
  fatores AS (
    SELECT a.empresa,
           a.produto_raiz,
           COALESCE((SELECT fps.fator_un FROM fator_por_sku fps WHERE fps.sku = a.produto_raiz), 1) AS fator_cx_para_un,
           COALESCE((
             SELECT MAX(fps2.fator_un)
             FROM public.bom_edges be
             JOIN fator_por_sku fps2 ON fps2.sku = be.filho_cod
             WHERE be.ativo = true AND be.pai_cod = a.produto_raiz
           ), 1) AS fator_bx_para_un
    FROM agg a
  )
  INSERT INTO public.estoque_unificado_cache (
    empresa, produto_raiz,
    saldo_em_caixas, saldo_em_displays, saldo_em_unidades,
    saldo_total_em_unidades,
    bloqueado_total_em_unidades, disponivel_total_em_unidades, pendente_total_em_unidades,
    custo_total, skus_envolvidos,
    fator_cx_para_un, fator_bx_para_un, ean_raiz, atualizado_em
  )
  SELECT a.empresa, a.produto_raiz,
         a.saldo_em_caixas, a.saldo_em_displays, a.saldo_em_unidades,
         a.saldo_total_em_unidades,
         a.bloqueado_total_em_unidades, a.disponivel_total_em_unidades, a.pendente_total_em_unidades,
         a.custo_total, a.skus_envolvidos,
         f.fator_cx_para_un, f.fator_bx_para_un,
         fp.codigo_barras_ean,
         now()
  FROM agg a
  LEFT JOIN fatores f ON f.empresa = a.empresa AND f.produto_raiz = a.produto_raiz
  LEFT JOIN public.fabrica_produtos fp ON fp.codigo::text = a.produto_raiz::text;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- 3) View raiz
DROP VIEW IF EXISTS public.vw_estoque_unificado;
CREATE VIEW public.vw_estoque_unificado AS
SELECT empresa,
       produto_raiz,
       saldo_em_caixas,
       saldo_em_displays,
       saldo_em_unidades,
       saldo_total_em_unidades,
       bloqueado_total_em_unidades,
       disponivel_total_em_unidades,
       pendente_total_em_unidades,
       custo_total,
       skus_envolvidos,
       fator_cx_para_un,
       fator_bx_para_un,
       ean_raiz
FROM public.estoque_unificado_cache;

GRANT SELECT ON public.vw_estoque_unificado TO authenticated;

-- 4) View por SKU com bloqueado/pendente/disponivel
DROP VIEW IF EXISTS public.vw_estoque_unificado_skus;
CREATE VIEW public.vw_estoque_unificado_skus AS
WITH RECURSIVE fator_desc AS (
  SELECT DISTINCT b.filho_cod AS sku, 1::numeric AS fator
  FROM public.bom_edges b
  WHERE b.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM public.bom_edges b2
      WHERE b2.ativo = true AND b2.pai_cod = b.filho_cod
    )
  UNION ALL
  SELECT b.pai_cod, (b.quantidade * fd.fator)::numeric
  FROM public.bom_edges b
  JOIN fator_desc fd ON fd.sku = b.filho_cod
  WHERE b.ativo = true
),
fator_por_sku AS (
  SELECT sku, MAX(fator) AS fator_un
  FROM fator_desc
  GROUP BY sku
),
estoque AS (
  SELECT e.empresa_par AS empresa,
         e.cod_produto,
         MAX(e.nome_prod) AS nome_prod,
         MAX(e.abrev_par) AS abrev_par,
         SUM(COALESCE(e.saldo, 0))                     AS saldo,
         SUM(COALESCE(e.estoque_bloqueado_produto, 0)) AS bloqueado,
         SUM(COALESCE(e.pedido_pendente, 0))           AS pendente,
         SUM(COALESCE(e.custo_total, 0))               AS custo_total
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
  GROUP BY e.empresa_par, e.cod_produto
),
classificado AS (
  SELECT es.empresa, es.cod_produto, es.nome_prod, es.abrev_par,
         es.saldo, es.bloqueado, es.pendente, es.custo_total,
         GREATEST(es.saldo - es.bloqueado, 0) AS disponivel,
         n.nivel,
         COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
  FROM estoque es
  LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
),
pai_de AS (
  SELECT DISTINCT ON (be.filho_cod) be.filho_cod, be.pai_cod, be.quantidade
  FROM public.bom_edges be
  WHERE be.ativo = true
  ORDER BY be.filho_cod, be.updated_at DESC
)
SELECT c.empresa,
       c.produto_raiz,
       c.cod_produto,
       c.nome_prod,
       c.abrev_par,
       fp.codigo_barras_ean,
       c.nivel,
       pd.pai_cod,
       pd.quantidade AS fator_pai_para_filho,
       COALESCE(fps.fator_un, 1) AS fator_un_acumulado,
       c.saldo,
       c.bloqueado,
       c.pendente,
       c.disponivel,
       c.custo_total,
       c.saldo      * COALESCE(fps.fator_un, 1) AS contribuicao_un,
       c.bloqueado  * COALESCE(fps.fator_un, 1) AS contribuicao_bloqueado_un,
       c.disponivel * COALESCE(fps.fator_un, 1) AS contribuicao_disponivel_un,
       c.pendente   * COALESCE(fps.fator_un, 1) AS contribuicao_pendente_un
FROM classificado c
LEFT JOIN fator_por_sku fps ON fps.sku = c.cod_produto
LEFT JOIN pai_de pd ON pd.filho_cod = c.cod_produto
LEFT JOIN public.fabrica_produtos fp ON fp.codigo::text = c.cod_produto::text;

GRANT SELECT ON public.vw_estoque_unificado_skus TO authenticated;

-- 5) Atualiza o cache para refletir os novos campos
SELECT public.refresh_estoque_unificado_cache();
