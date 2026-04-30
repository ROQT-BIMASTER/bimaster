
CREATE OR REPLACE VIEW public.vw_estoque_unificado
WITH (security_invoker = true) AS
WITH estoque AS (
  SELECT e.empresa_par AS empresa,
         e.cod_produto,
         SUM(COALESCE(e.saldo, 0)) AS saldo_total,
         SUM(COALESCE(e.custo_total, 0)) AS custo_total
    FROM public.erp_estoque_distribuidora e
   WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
   GROUP BY e.empresa_par, e.cod_produto
), classificado AS (
  SELECT es.empresa, es.cod_produto, es.saldo_total, es.custo_total,
         n.nivel,
         COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
    FROM estoque es
    LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
)
SELECT empresa,
       produto_raiz,
       SUM(CASE WHEN nivel = 1 THEN saldo_total ELSE 0 END) AS saldo_em_caixas,
       SUM(CASE WHEN nivel = 2 THEN saldo_total ELSE 0 END) AS saldo_em_displays,
       SUM(CASE WHEN nivel = 3 THEN saldo_total ELSE 0 END) AS saldo_em_unidades,
       COALESCE(SUM(saldo_total * COALESCE(
         (SELECT MAX(p.fator_acumulado)
            FROM public.vw_bom_path p
           WHERE p.empresa = c.empresa
             AND p.raiz_cod = c.produto_raiz
             AND p.folha_cod = c.cod_produto),
         1
       )), 0) AS saldo_total_em_unidades,
       SUM(custo_total) AS custo_total,
       COUNT(DISTINCT cod_produto) AS skus_envolvidos
  FROM classificado c
 GROUP BY empresa, produto_raiz;

GRANT SELECT ON public.vw_estoque_unificado TO authenticated;

CREATE OR REPLACE VIEW public.vw_drift_erp_unificado
WITH (security_invoker = true) AS
WITH internos AS (
  SELECT empresa, cod_produto, SUM(quantidade) AS saldo_interno
    FROM public.estoque_lote_interno
   GROUP BY empresa, cod_produto
), erp AS (
  SELECT empresa_par AS empresa, cod_produto,
         SUM(saldo) AS saldo_erp,
         MAX(nome_prod) AS nome_prod
    FROM public.erp_estoque_distribuidora
   WHERE cod_produto IS NOT NULL AND empresa_par IS NOT NULL
   GROUP BY empresa_par, cod_produto
)
SELECT i.empresa,
       i.cod_produto,
       e.nome_prod,
       COALESCE(i.saldo_interno, 0) AS saldo_interno,
       COALESCE(e.saldo_erp, 0)     AS saldo_erp,
       COALESCE(i.saldo_interno, 0) - COALESCE(e.saldo_erp, 0) AS drift,
       CASE
         WHEN COALESCE(e.saldo_erp, 0) = 0 AND COALESCE(i.saldo_interno, 0) = 0 THEN 0
         WHEN COALESCE(e.saldo_erp, 0) = 0 THEN 100
         ELSE ROUND(
           ABS(COALESCE(i.saldo_interno,0) - COALESCE(e.saldo_erp,0))
           / NULLIF(COALESCE(e.saldo_erp,0), 0) * 100, 2)
       END AS drift_pct
  FROM internos i
  LEFT JOIN erp e USING (empresa, cod_produto);

GRANT SELECT ON public.vw_drift_erp_unificado TO authenticated;
