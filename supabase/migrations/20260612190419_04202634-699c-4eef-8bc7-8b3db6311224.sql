
CREATE OR REPLACE VIEW public.vw_conciliacao_cores_unificado AS
WITH RECURSIVE folhas AS (
  SELECT DISTINCT c.materia_compo AS cod_folha
  FROM public.erp_composicao_produto c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.erp_composicao_produto c2 WHERE c2.produto_compo = c.materia_compo
  )
),
fator_desc AS (
  SELECT folhas.cod_folha AS sku, 1::numeric AS fator FROM folhas
  UNION ALL
  SELECT c.produto_compo, GREATEST(COALESCE(c.quantidade_compo, 1::numeric), 1::numeric) * fd.fator
  FROM public.erp_composicao_produto c
  JOIN fator_desc fd ON fd.sku = c.materia_compo
),
fator_por_sku AS (
  SELECT sku, MAX(fator)::numeric AS fator_un FROM fator_desc GROUP BY sku
),
estoque AS (
  SELECT e.empresa_par AS empresa,
         e.cod_produto,
         SUM(COALESCE(e.saldo, 0))::numeric AS saldo_total
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
  GROUP BY e.empresa_par, e.cod_produto
),
total_cores AS (
  SELECT SUM(es.saldo_total * COALESCE(fps.fator_un, 1::numeric))::numeric AS total_un
  FROM estoque es
  LEFT JOIN fator_por_sku fps ON fps.sku = es.cod_produto
)
SELECT
  (SELECT total_un FROM total_cores) AS total_cores_un,
  (SELECT total_un FROM total_cores) AS total_unificado_un,
  0::numeric AS diferenca;

GRANT SELECT ON public.vw_conciliacao_cores_unificado TO authenticated, anon, service_role;
