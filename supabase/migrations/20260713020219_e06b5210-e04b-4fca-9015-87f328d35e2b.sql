
CREATE OR REPLACE FUNCTION public.recalcular_estoque_niveis()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
  v_regressao INTEGER;
BEGIN
  -- ============================================================
  -- Regra TOPOLÓGICA (não usa profundidade máxima):
  --   nivel 1 → pai na BOM e NÃO aparece como filho (raiz)
  --   nivel 2 → pai E filho (intermediário, em qualquer profundidade)
  --   nivel 3 → NÃO é pai (folha; inclui SKUs fora da BOM)
  --
  -- Invariante garantido: nenhum SKU folha (nivel=3) pode ter
  -- fator_un_acumulado > 1, pois o fator só nasce de filhos.
  -- ============================================================
  TRUNCATE public.estoque_produto_nivel;

  WITH RECURSIVE
  todos_skus AS (
    SELECT DISTINCT cod_produto FROM public.erp_estoque_distribuidora WHERE cod_produto IS NOT NULL
    UNION
    SELECT DISTINCT pai_cod   FROM public.bom_edges WHERE ativo
    UNION
    SELECT DISTINCT filho_cod FROM public.bom_edges WHERE ativo
  ),
  paes  AS (SELECT DISTINCT pai_cod   AS cod FROM public.bom_edges WHERE ativo),
  filhos AS (SELECT DISTINCT filho_cod AS cod FROM public.bom_edges WHERE ativo),
  raizes AS (
    SELECT p.cod FROM paes p
    LEFT JOIN filhos f ON f.cod = p.cod WHERE f.cod IS NULL
  ),
  rec AS (
    SELECT r.cod AS raiz, r.cod AS atual, 1 AS profundidade, ARRAY[r.cod] AS caminho
    FROM raizes r
    UNION ALL
    SELECT r.raiz, e.filho_cod, r.profundidade + 1, r.caminho || e.filho_cod
    FROM rec r
    JOIN public.bom_edges e ON e.pai_cod = r.atual AND e.ativo
    WHERE r.profundidade < 5 AND NOT (e.filho_cod = ANY(r.caminho))
  ),
  raiz_de AS (
    SELECT atual AS cod, raiz,
           ROW_NUMBER() OVER (PARTITION BY atual ORDER BY COUNT(*) DESC, raiz) AS rn
    FROM rec GROUP BY atual, raiz
  )
  INSERT INTO public.estoque_produto_nivel (cod_produto, nivel, produto_raiz, eh_folha, eh_raiz, recalculado_em)
  SELECT
    s.cod_produto,
    CASE
      WHEN s.cod_produto IN (SELECT cod FROM raizes) THEN 1
      WHEN s.cod_produto IN (SELECT cod FROM paes)   THEN 2
      ELSE                                                3
    END AS nivel,
    COALESCE(rd.raiz, s.cod_produto) AS produto_raiz,
    (s.cod_produto NOT IN (SELECT cod FROM paes)) AS eh_folha,
    (s.cod_produto IN     (SELECT cod FROM raizes)) AS eh_raiz,
    now()
  FROM todos_skus s
  LEFT JOIN raiz_de rd ON rd.cod = s.cod_produto AND rd.rn = 1;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM public.refresh_estoque_unificado_cache();

  SELECT COUNT(*) INTO v_regressao
  FROM public.vw_estoque_unificado_skus
  WHERE nivel = 3 AND fator_un_acumulado > 1;

  IF v_regressao > 0 THEN
    RAISE WARNING 'recalcular_estoque_niveis: % SKU(s) de nivel 3 com fator_un_acumulado > 1 — regra topológica violada, investigue bom_edges/erp_composicao_produto', v_regressao;
  END IF;

  RETURN v_count;
END;
$function$;
