
CREATE OR REPLACE FUNCTION public.rpc_estoque_unificado_kpis(
  p_empresa_ids integer[] DEFAULT NULL,
  p_somente_com_saldo boolean DEFAULT true,
  p_marcas text[] DEFAULT NULL,
  p_linhas text[] DEFAULT NULL,
  p_busca text DEFAULT NULL
)
RETURNS TABLE (
  total_un numeric,
  bloqueado_un numeric,
  disponivel_un numeric,
  pendente_un numeric,
  caixas numeric,
  displays numeric,
  unidades numeric,
  custo_total numeric,
  produtos_count integer,
  disponivel_cx numeric,
  sem_fator_cx integer,
  equivalente_cx numeric,
  equivalente_bx numeric,
  sem_fator_bx integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      c.empresa,
      c.produto_raiz,
      c.saldo_em_caixas,
      c.saldo_em_displays,
      c.saldo_em_unidades,
      c.saldo_total_em_unidades,
      c.bloqueado_total_em_unidades,
      c.disponivel_total_em_unidades,
      c.pendente_total_em_unidades,
      c.custo_total,
      c.fator_cx_para_un,
      c.fator_bx_para_un,
      c.nome_raiz,
      (
        SELECT MAX(p.marca) FROM rr_produtos p
        WHERE p.sku::text = c.produto_raiz::text AND p.marca IS NOT NULL
      ) AS marca,
      (
        SELECT MAX(e.nome_linha) FROM erp_estoque_distribuidora e
        WHERE e.cod_produto = c.produto_raiz AND e.nome_linha IS NOT NULL
      ) AS linha
    FROM public.estoque_unificado_cache c
    WHERE (p_empresa_ids IS NULL OR array_length(p_empresa_ids,1) IS NULL OR c.empresa = ANY(p_empresa_ids))
      AND (NOT p_somente_com_saldo OR c.saldo_total_em_unidades > 0)
  ), filtered AS (
    SELECT * FROM base b
    WHERE (p_marcas IS NULL OR array_length(p_marcas,1) IS NULL
           OR (b.marca IS NOT NULL AND lower(b.marca) = ANY(SELECT lower(x) FROM unnest(p_marcas) x)))
      AND (p_linhas IS NULL OR array_length(p_linhas,1) IS NULL
           OR (b.linha IS NOT NULL AND lower(b.linha) = ANY(SELECT lower(x) FROM unnest(p_linhas) x)))
      AND (
        p_busca IS NULL OR length(btrim(p_busca)) < 2
        OR (
          CASE WHEN btrim(p_busca) ~ '^\d+$'
               THEN b.produto_raiz::text = btrim(p_busca)
               ELSE lower(coalesce(b.nome_raiz,'')) LIKE '%'||lower(btrim(p_busca))||'%'
                 OR lower(coalesce(b.marca,''))    LIKE '%'||lower(btrim(p_busca))||'%'
                 OR lower(coalesce(b.linha,''))    LIKE '%'||lower(btrim(p_busca))||'%'
          END
        )
      )
  ), consolidated AS (
    SELECT
      produto_raiz,
      SUM(saldo_em_caixas)               AS saldo_em_caixas,
      SUM(saldo_em_displays)             AS saldo_em_displays,
      SUM(saldo_em_unidades)             AS saldo_em_unidades,
      SUM(saldo_total_em_unidades)       AS saldo_total_em_unidades,
      SUM(bloqueado_total_em_unidades)   AS bloqueado_total_em_unidades,
      SUM(disponivel_total_em_unidades)  AS disponivel_total_em_unidades,
      SUM(pendente_total_em_unidades)    AS pendente_total_em_unidades,
      SUM(custo_total)                   AS custo_total,
      MAX(fator_cx_para_un)              AS fator_cx_para_un,
      MAX(fator_bx_para_un)              AS fator_bx_para_un
    FROM filtered
    GROUP BY produto_raiz
  )
  SELECT
    COALESCE(SUM(saldo_total_em_unidades),0)::numeric,
    COALESCE(SUM(bloqueado_total_em_unidades),0)::numeric,
    COALESCE(SUM(disponivel_total_em_unidades),0)::numeric,
    COALESCE(SUM(pendente_total_em_unidades),0)::numeric,
    COALESCE(SUM(saldo_em_caixas),0)::numeric,
    COALESCE(SUM(saldo_em_displays),0)::numeric,
    COALESCE(SUM(saldo_em_unidades),0)::numeric,
    COALESCE(SUM(custo_total),0)::numeric,
    COUNT(*)::int,
    COALESCE(SUM(CASE WHEN fator_cx_para_un > 0 THEN disponivel_total_em_unidades / fator_cx_para_un END),0)::numeric,
    COUNT(*) FILTER (WHERE fator_cx_para_un IS NULL OR fator_cx_para_un <= 0)::int,
    COALESCE(SUM(CASE WHEN fator_cx_para_un > 0 THEN saldo_total_em_unidades / fator_cx_para_un END),0)::numeric,
    COALESCE(SUM(CASE WHEN fator_bx_para_un > 0 THEN saldo_total_em_unidades / fator_bx_para_un END),0)::numeric,
    COUNT(*) FILTER (WHERE fator_bx_para_un IS NULL OR fator_bx_para_un <= 0)::int
  FROM consolidated;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_estoque_unificado_kpis(integer[], boolean, text[], text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_estoque_unificado_kpis(integer[], boolean, text[], text[], text) TO service_role;
