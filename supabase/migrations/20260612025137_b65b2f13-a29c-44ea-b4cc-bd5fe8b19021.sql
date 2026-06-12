CREATE OR REPLACE FUNCTION public.rpc_estoque_cores_kpis(
  p_empresas integer[] DEFAULT NULL::integer[],
  p_linhas text[] DEFAULT NULL::text[],
  p_campanha_ids uuid[] DEFAULT NULL::uuid[],
  p_busca text DEFAULT NULL::text,
  p_apenas_com_saldo boolean DEFAULT false,
  p_com_pedido_pendente boolean DEFAULT false,
  p_curva_fisica text[] DEFAULT NULL::text[],
  p_curva_monetaria text[] DEFAULT NULL::text[],
  p_incluir_potencial boolean DEFAULT true
)
RETURNS TABLE(
  total_skus bigint,
  total_unidades numeric,
  total_unidades_potencial numeric,
  total_custo numeric,
  total_valor_venda numeric,
  total_pedido_pendente numeric,
  itens_sem_saldo bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
  v_empresas integer[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  v_is_admin := has_role(v_user,'admin'::app_role) OR has_role(v_user,'gerente'::app_role);
  IF v_is_admin THEN
    SELECT array_agg(DISTINCT empresa_par) INTO v_empresas FROM erp_estoque_distribuidora WHERE empresa_par IS NOT NULL;
  ELSE
    SELECT array_agg(DISTINCT empresa_id) INTO v_empresas FROM user_empresas WHERE user_id = v_user;
  END IF;
  IF v_empresas IS NULL THEN v_empresas := ARRAY[]::integer[]; END IF;
  IF p_empresas IS NOT NULL AND array_length(p_empresas,1)>0 THEN
    v_empresas := ARRAY(SELECT unnest(v_empresas) INTERSECT SELECT unnest(p_empresas));
  END IF;

  RETURN QUERY
  WITH RECURSIVE
  folhas AS (
    SELECT DISTINCT c.materia_compo AS cod_folha
    FROM erp_composicao_produto c
    WHERE NOT EXISTS (SELECT 1 FROM erp_composicao_produto c2 WHERE c2.produto_compo = c.materia_compo)
  ),
  path AS (
    SELECT f.cod_folha, f.cod_folha AS cod_ancestor, 1::numeric AS fator, 0 AS depth,
           ARRAY[f.cod_folha]::integer[] AS visited
    FROM folhas f
    UNION ALL
    SELECT p.cod_folha, c.produto_compo,
           p.fator * GREATEST(COALESCE(c.quantidade_compo,1)::numeric, 1::numeric),
           p.depth + 1,
           p.visited || c.produto_compo
    FROM path p
    JOIN erp_composicao_produto c ON c.materia_compo = p.cod_ancestor
    WHERE p.depth < 6 AND NOT (c.produto_compo = ANY(p.visited))
  ),
  best_leaf AS (
    SELECT DISTINCT ON (cod_ancestor)
           cod_ancestor AS cod_produto,
           cod_folha,
           fator
    FROM path
    ORDER BY cod_ancestor, fator DESC, cod_folha
  ),
  saldos AS (
    SELECT e.empresa_par, e.cod_produto, COALESCE(e.saldo,0)::numeric AS saldo
    FROM erp_estoque_distribuidora e
    WHERE e.empresa_par = ANY(v_empresas)
  ),
  -- Mapa SKU -> folha canônica + fator. SKUs sem composição: tratados como folha (fator 1).
  mapa AS (
    SELECT s.empresa_par,
           s.cod_produto AS cod_sku,
           COALESCE(bl.cod_folha, s.cod_produto) AS cod_folha,
           COALESCE(bl.fator, 1::numeric) AS fator,
           s.saldo
    FROM saldos s
    LEFT JOIN best_leaf bl ON bl.cod_produto = s.cod_produto
  ),
  contrib AS (
    SELECT m.empresa_par,
           m.cod_folha AS cod_produto,
           SUM(CASE WHEN m.cod_sku = m.cod_folha THEN m.saldo ELSE 0 END) AS saldo_proprio,
           SUM(CASE WHEN m.cod_sku <> m.cod_folha THEN m.saldo * m.fator ELSE 0 END) AS saldo_potencial
    FROM mapa m
    GROUP BY 1, 2
  ),
  meta AS (
    SELECT DISTINCT ON (e.empresa_par, e.cod_produto)
           e.empresa_par, e.cod_produto,
           e.nome_linha, e.curva_fisica, e.curva_monetaria,
           e.nome_prod, e.cod_fabricante,
           e.pedido_pendente, e.custo_unitario, e.custo_total, e.valor_venda
    FROM erp_estoque_distribuidora e
    WHERE e.empresa_par = ANY(v_empresas)
    ORDER BY e.empresa_par, e.cod_produto
  ),
  base AS (
    SELECT c.empresa_par, c.cod_produto,
           c.saldo_proprio, c.saldo_potencial,
           m.nome_linha, m.curva_fisica, m.curva_monetaria,
           m.nome_prod, m.cod_fabricante,
           m.pedido_pendente, m.custo_unitario, m.custo_total, m.valor_venda
    FROM contrib c
    LEFT JOIN meta m
      ON m.empresa_par = c.empresa_par AND m.cod_produto = c.cod_produto
  ),
  f AS (
    SELECT * FROM base b
    WHERE (p_linhas IS NULL OR b.nome_linha = ANY(p_linhas))
      AND (p_curva_fisica IS NULL OR b.curva_fisica = ANY(p_curva_fisica))
      AND (p_curva_monetaria IS NULL OR b.curva_monetaria = ANY(p_curva_monetaria))
      AND (NOT p_com_pedido_pendente OR COALESCE(b.pedido_pendente,0) > 0)
      AND (p_busca IS NULL OR p_busca = '' OR
           b.nome_prod ILIKE '%'||p_busca||'%' OR
           b.cod_fabricante ILIKE '%'||p_busca||'%' OR
           b.cod_produto::text = p_busca)
      AND (p_campanha_ids IS NULL OR EXISTS (
            SELECT 1 FROM estoque_etiqueta_produtos ep
            WHERE ep.cod_produto = b.cod_produto AND ep.etiqueta_id = ANY(p_campanha_ids)
      ))
      AND (NOT p_apenas_com_saldo OR
           (CASE WHEN p_incluir_potencial THEN b.saldo_proprio + b.saldo_potencial ELSE b.saldo_proprio END) > 0)
  )
  SELECT
    COUNT(*)::bigint,
    SUM(CASE WHEN p_incluir_potencial THEN f.saldo_proprio + f.saldo_potencial ELSE f.saldo_proprio END)::numeric,
    SUM(f.saldo_potencial)::numeric,
    SUM(COALESCE(f.custo_total,0))::numeric,
    SUM(COALESCE(f.valor_venda,0) * f.saldo_proprio)::numeric,
    SUM(COALESCE(f.pedido_pendente,0))::numeric,
    COUNT(*) FILTER (WHERE (CASE WHEN p_incluir_potencial THEN f.saldo_proprio + f.saldo_potencial ELSE f.saldo_proprio END) <= 0)::bigint
  FROM f;
END
$function$;