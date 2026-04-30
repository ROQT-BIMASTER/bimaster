CREATE OR REPLACE FUNCTION public.refresh_estoque_unificado_cache()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  TRUNCATE public.estoque_unificado_cache;

  WITH estoque AS (
    SELECT e.empresa_par AS empresa,
           e.cod_produto,
           sum(COALESCE(e.saldo, 0)) AS saldo_total,
           sum(COALESCE(e.custo_total, 0)) AS custo_total
    FROM public.erp_estoque_distribuidora e
    WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
    GROUP BY e.empresa_par, e.cod_produto
  ),
  classificado AS (
    SELECT es.empresa, es.cod_produto, es.saldo_total, es.custo_total,
           n.nivel,
           COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
    FROM estoque es
    LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
  ),
  -- Caminho único por (raiz, folha-UN): pega o de maior profundidade (folha real)
  folhas_un AS (
    SELECT DISTINCT ON (p.raiz_cod, p.folha_cod)
      p.raiz_cod,
      p.folha_cod,
      p.fator_acumulado AS fator_un,
      p.caminho[2] AS mae_cod
    FROM public.vw_bom_path p
    JOIN public.estoque_produto_nivel nf
      ON nf.cod_produto = p.folha_cod AND nf.nivel = 3
    WHERE p.profundidade >= 1
    ORDER BY p.raiz_cod, p.folha_cod, p.profundidade DESC
  ),
  agg AS (
    SELECT c.empresa,
           c.produto_raiz,
           sum(CASE WHEN c.nivel = 1 THEN c.saldo_total ELSE 0 END) AS saldo_em_caixas,
           sum(CASE WHEN c.nivel = 2 THEN c.saldo_total ELSE 0 END) AS saldo_em_displays,
           sum(CASE WHEN c.nivel = 3 THEN c.saldo_total ELSE 0 END) AS saldo_em_unidades,
           COALESCE(sum(c.saldo_total * COALESCE((
             SELECT fu.fator_un
             FROM folhas_un fu
             WHERE fu.raiz_cod = c.produto_raiz AND fu.folha_cod = c.cod_produto
           ), 1)), 0) AS saldo_total_em_unidades,
           sum(c.custo_total) AS custo_total,
           count(DISTINCT c.cod_produto)::int AS skus_envolvidos
    FROM classificado c
    GROUP BY c.empresa, c.produto_raiz
  ),
  fatores AS (
    SELECT a.empresa,
           a.produto_raiz,
           -- CX → UN: soma dos fatores de TODAS as folhas UN sob a raiz
           COALESCE((
             SELECT SUM(fu.fator_un)
             FROM folhas_un fu
             WHERE fu.raiz_cod = a.produto_raiz
           ), 1) AS fator_cx_para_un,
           -- BX → UN: total UN ÷ qtd de mães distintas (média ponderada)
           COALESCE((
             SELECT SUM(fu.fator_un) / NULLIF(COUNT(DISTINCT fu.mae_cod), 0)
             FROM folhas_un fu
             WHERE fu.raiz_cod = a.produto_raiz AND fu.mae_cod IS NOT NULL
           ), 1) AS fator_bx_para_un
    FROM agg a
  )
  INSERT INTO public.estoque_unificado_cache (
    empresa, produto_raiz,
    saldo_em_caixas, saldo_em_displays, saldo_em_unidades,
    saldo_total_em_unidades, custo_total, skus_envolvidos,
    fator_cx_para_un, fator_bx_para_un, ean_raiz, atualizado_em
  )
  SELECT a.empresa, a.produto_raiz,
         a.saldo_em_caixas, a.saldo_em_displays, a.saldo_em_unidades,
         a.saldo_total_em_unidades, a.custo_total, a.skus_envolvidos,
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

-- Recalcula o cache imediatamente com a nova fórmula
SELECT public.refresh_estoque_unificado_cache();