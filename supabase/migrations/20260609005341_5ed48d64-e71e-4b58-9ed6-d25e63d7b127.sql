CREATE OR REPLACE FUNCTION public.estoque_validar_consolidado_erp(
  p_produto_raizes integer[],
  p_empresas integer[] DEFAULT NULL
)
RETURNS TABLE (
  produto_raiz integer,
  cache_saldo_em_caixas numeric,
  cache_saldo_total_em_unidades numeric,
  cache_bloqueado_total_em_unidades numeric,
  cache_disponivel_total_em_unidades numeric,
  cache_custo_total numeric,
  erp_saldo_em_caixas numeric,
  erp_saldo_total_em_unidades numeric,
  erp_bloqueado_total_em_unidades numeric,
  erp_disponivel_total_em_unidades numeric,
  erp_custo_total numeric,
  delta_saldo_total_em_unidades numeric,
  delta_bloqueado_total_em_unidades numeric,
  delta_disponivel_total_em_unidades numeric,
  delta_custo_total numeric,
  filiais_count integer,
  filiais_sync jsonb,
  ultima_sync timestamptz,
  filiais_defasadas integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
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
    SELECT fd.sku, MAX(fd.fator)::numeric AS fator_un
    FROM fator_desc fd
    GROUP BY fd.sku
  ),
  estoque_raw AS (
    SELECT e.empresa_par AS empresa,
           e.abrev_par,
           e.cod_produto,
           SUM(COALESCE(e.saldo, 0))                     AS saldo_total,
           SUM(COALESCE(e.estoque_bloqueado_produto, 0)) AS bloqueado_total,
           SUM(COALESCE(e.custo_total, 0))               AS custo_total,
           MAX(e.sincronizado_em)                        AS sincronizado_em
    FROM public.erp_estoque_distribuidora e
    WHERE e.cod_produto IS NOT NULL
      AND e.empresa_par IS NOT NULL
      AND (p_empresas IS NULL OR e.empresa_par = ANY(p_empresas))
    GROUP BY e.empresa_par, e.abrev_par, e.cod_produto
  ),
  classificado AS (
    SELECT er.empresa,
           er.abrev_par,
           er.cod_produto,
           er.saldo_total,
           er.bloqueado_total,
           GREATEST(er.saldo_total - er.bloqueado_total, 0) AS disponivel_total,
           er.custo_total,
           er.sincronizado_em,
           n.nivel,
           COALESCE(n.produto_raiz, er.cod_produto) AS produto_raiz,
           COALESCE(fps.fator_un, 1)::numeric AS fator_un
    FROM estoque_raw er
    LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = er.cod_produto
    LEFT JOIN fator_por_sku fps ON fps.sku = er.cod_produto
  ),
  classificado_filtrado AS (
    SELECT c.* FROM classificado c
    WHERE c.produto_raiz = ANY(p_produto_raizes)
  ),
  erp_por_filial AS (
    SELECT cf.produto_raiz,
           cf.empresa,
           cf.abrev_par,
           SUM(CASE WHEN cf.nivel = 1 THEN cf.saldo_total ELSE 0 END) AS saldo_em_caixas,
           SUM(cf.saldo_total      * cf.fator_un) AS saldo_total_em_unidades,
           SUM(cf.bloqueado_total  * cf.fator_un) AS bloqueado_total_em_unidades,
           SUM(cf.disponivel_total * cf.fator_un) AS disponivel_total_em_unidades,
           SUM(cf.custo_total) AS custo_total,
           MAX(cf.sincronizado_em) AS sincronizado_em
    FROM classificado_filtrado cf
    GROUP BY cf.produto_raiz, cf.empresa, cf.abrev_par
  ),
  erp_agg AS (
    SELECT epf.produto_raiz,
           SUM(epf.saldo_em_caixas) AS erp_saldo_em_caixas,
           SUM(epf.saldo_total_em_unidades) AS erp_saldo_total_em_unidades,
           SUM(epf.bloqueado_total_em_unidades) AS erp_bloqueado_total_em_unidades,
           SUM(epf.disponivel_total_em_unidades) AS erp_disponivel_total_em_unidades,
           SUM(epf.custo_total) AS erp_custo_total,
           COUNT(*)::int AS filiais_count,
           MAX(epf.sincronizado_em) AS ultima_sync,
           COUNT(*) FILTER (WHERE epf.sincronizado_em < now() - interval '24 hours')::int AS filiais_defasadas,
           jsonb_agg(
             jsonb_build_object(
               'empresa', epf.empresa,
               'abrev', epf.abrev_par,
               'sincronizado_em', epf.sincronizado_em,
               'idade_horas', EXTRACT(EPOCH FROM (now() - epf.sincronizado_em))/3600
             )
             ORDER BY epf.empresa
           ) AS filiais_sync
    FROM erp_por_filial epf
    GROUP BY epf.produto_raiz
  ),
  cache_agg AS (
    SELECT c.produto_raiz,
           SUM(c.saldo_em_caixas) AS cache_saldo_em_caixas,
           SUM(c.saldo_total_em_unidades) AS cache_saldo_total_em_unidades,
           SUM(c.bloqueado_total_em_unidades) AS cache_bloqueado_total_em_unidades,
           SUM(c.disponivel_total_em_unidades) AS cache_disponivel_total_em_unidades,
           SUM(c.custo_total) AS cache_custo_total
    FROM public.estoque_unificado_cache c
    WHERE c.produto_raiz = ANY(p_produto_raizes)
      AND (p_empresas IS NULL OR c.empresa = ANY(p_empresas))
    GROUP BY c.produto_raiz
  )
  SELECT
    COALESCE(ca.produto_raiz, ea.produto_raiz) AS produto_raiz,
    COALESCE(ca.cache_saldo_em_caixas, 0),
    COALESCE(ca.cache_saldo_total_em_unidades, 0),
    COALESCE(ca.cache_bloqueado_total_em_unidades, 0),
    COALESCE(ca.cache_disponivel_total_em_unidades, 0),
    COALESCE(ca.cache_custo_total, 0),
    COALESCE(ea.erp_saldo_em_caixas, 0),
    COALESCE(ea.erp_saldo_total_em_unidades, 0),
    COALESCE(ea.erp_bloqueado_total_em_unidades, 0),
    COALESCE(ea.erp_disponivel_total_em_unidades, 0),
    COALESCE(ea.erp_custo_total, 0),
    COALESCE(ca.cache_saldo_total_em_unidades, 0) - COALESCE(ea.erp_saldo_total_em_unidades, 0),
    COALESCE(ca.cache_bloqueado_total_em_unidades, 0) - COALESCE(ea.erp_bloqueado_total_em_unidades, 0),
    COALESCE(ca.cache_disponivel_total_em_unidades, 0) - COALESCE(ea.erp_disponivel_total_em_unidades, 0),
    COALESCE(ca.cache_custo_total, 0) - COALESCE(ea.erp_custo_total, 0),
    COALESCE(ea.filiais_count, 0),
    COALESCE(ea.filiais_sync, '[]'::jsonb),
    ea.ultima_sync,
    COALESCE(ea.filiais_defasadas, 0)
  FROM cache_agg ca
  FULL OUTER JOIN erp_agg ea ON ea.produto_raiz = ca.produto_raiz;
END;
$$;

GRANT EXECUTE ON FUNCTION public.estoque_validar_consolidado_erp(integer[], integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estoque_validar_consolidado_erp(integer[], integer[]) TO service_role;