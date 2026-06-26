
CREATE OR REPLACE FUNCTION public.vendas_produto_resumo(
  p_data_ini date,
  p_data_fim date,
  p_empresa_id smallint DEFAULT NULL
)
RETURNS TABLE (
  cod_produto       text,
  descricao         text,
  marca             text,
  nome_linha        text,
  meses_no_periodo  int,
  meses_com_venda   int,
  qtd_total         numeric,
  valor_total       numeric,
  media_mensal      numeric,
  desvio_mensal     numeric,
  cv                numeric,
  classe_abc        text,
  classe_xyz        text,
  estoque_atual     numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH
periodo AS (
  SELECT
    date_trunc('month', p_data_ini)::date AS ini,
    date_trunc('month', p_data_fim)::date AS fim
),
meses AS (
  SELECT generate_series(p.ini, p.fim, interval '1 month')::date AS mes
  FROM periodo p
),
itens AS (
  SELECT
    i.cod_produto,
    MAX(i.descricao)                          AS descricao,
    date_trunc('month', v.data_emissao)::date AS mes,
    SUM(i.quantidade)                         AS qtd,
    SUM(i.total_item)                         AS valor
  FROM public.erp_vendas_item i
  JOIN public.erp_vendas v ON v.futura_nota_id = i.futura_nota_id
  WHERE v.data_emissao BETWEEN p_data_ini AND p_data_fim
    AND COALESCE(v.entrada_saida, 'S') = 'S'
    AND v.status > 0
    AND (p_empresa_id IS NULL OR v.empresa_id = p_empresa_id)
    AND i.cod_produto IS NOT NULL
  GROUP BY i.cod_produto, date_trunc('month', v.data_emissao)
),
grid AS (
  SELECT p.cod_produto, m.mes,
         COALESCE(i.qtd, 0)   AS qtd,
         COALESCE(i.valor, 0) AS valor
  FROM (SELECT DISTINCT cod_produto FROM itens) p
  CROSS JOIN meses m
  LEFT JOIN itens i
    ON i.cod_produto = p.cod_produto AND i.mes = m.mes
),
agg AS (
  SELECT
    g.cod_produto,
    COUNT(*)                            AS meses_no_periodo,
    COUNT(*) FILTER (WHERE g.qtd > 0)   AS meses_com_venda,
    SUM(g.qtd)                          AS qtd_total,
    SUM(g.valor)                        AS valor_total,
    AVG(g.qtd)                          AS media_mensal,
    stddev_samp(g.qtd)                  AS desvio_mensal
  FROM grid g
  GROUP BY g.cod_produto
),
marca_lkp AS (
  SELECT sku, MAX(marca) AS marca
  FROM public.rr_produtos
  WHERE sku IS NOT NULL
  GROUP BY sku
),
linha_lkp AS (
  SELECT cod_produto, MAX(nome_linha) AS nome_linha
  FROM public.erp_estoque_distribuidora
  WHERE cod_produto IS NOT NULL
  GROUP BY cod_produto
),
-- bridge SKU: soma saldo de todos os SKUs (filhos + raiz) com mesmo cod_produto
estoque_lkp AS (
  SELECT cod_produto, SUM(COALESCE(saldo, 0)) AS estoque_atual
  FROM public.vw_estoque_unificado_skus
  WHERE cod_produto IS NOT NULL
  GROUP BY cod_produto
),
descs AS (
  SELECT cod_produto, MAX(descricao) AS descricao
  FROM itens GROUP BY cod_produto
),
base AS (
  SELECT
    a.cod_produto,
    d.descricao,
    m.marca,
    l.nome_linha,
    a.meses_no_periodo,
    a.meses_com_venda,
    a.qtd_total,
    a.valor_total,
    a.media_mensal,
    a.desvio_mensal,
    CASE WHEN a.media_mensal > 0 THEN a.desvio_mensal / a.media_mensal END AS cv,
    COALESCE(e.estoque_atual, 0) AS estoque_atual
  FROM agg a
  LEFT JOIN descs d ON d.cod_produto = a.cod_produto
  LEFT JOIN marca_lkp m ON m.sku = a.cod_produto
  LEFT JOIN linha_lkp l
    ON l.cod_produto = CASE WHEN a.cod_produto ~ '^\d+$' THEN a.cod_produto::int END
  LEFT JOIN estoque_lkp e
    ON e.cod_produto = CASE WHEN a.cod_produto ~ '^\d+$' THEN a.cod_produto::int END
),
abc AS (
  SELECT
    b.*,
    SUM(b.valor_total) OVER () AS valor_grand_total,
    SUM(b.valor_total) OVER (ORDER BY b.valor_total DESC
                             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS valor_acum
  FROM base b
)
SELECT
  cod_produto, descricao, marca, nome_linha,
  meses_no_periodo, meses_com_venda, qtd_total, valor_total,
  media_mensal, desvio_mensal, cv,
  CASE
    WHEN valor_grand_total IS NULL OR valor_grand_total = 0 THEN 'C'
    WHEN valor_acum / valor_grand_total <= 0.80 THEN 'A'
    WHEN valor_acum / valor_grand_total <= 0.95 THEN 'B'
    ELSE 'C'
  END AS classe_abc,
  CASE
    WHEN cv IS NULL THEN 'Z'
    WHEN cv <= 0.5 THEN 'X'
    WHEN cv <= 1.0 THEN 'Y'
    ELSE 'Z'
  END AS classe_xyz,
  estoque_atual
FROM abc
ORDER BY valor_total DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.vendas_produto_resumo(date, date, smallint) FROM public;
GRANT EXECUTE ON FUNCTION public.vendas_produto_resumo(date, date, smallint) TO authenticated;

-- Menu: novo item "Vendas por produto"
INSERT INTO public.sidebar_menu_items (module_code, item_code, label, icon, route, ordem, ativo, screen_code)
VALUES ('fornecedor_vendas', 'forn_vendas_produtos', 'Vendas por produto', 'Package', '/dashboard/fornecedor/produtos', 5, true, 'fornecedor_vendas')
ON CONFLICT (module_code, item_code) DO UPDATE
  SET label = EXCLUDED.label,
      icon = EXCLUDED.icon,
      route = EXCLUDED.route,
      ativo = EXCLUDED.ativo,
      screen_code = EXCLUDED.screen_code;
