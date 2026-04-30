-- Estende vw_estoque_unificado com fatores de conversao por raiz e EAN raiz
DROP VIEW IF EXISTS public.vw_estoque_unificado CASCADE;

CREATE VIEW public.vw_estoque_unificado
WITH (security_invoker = true)
AS
WITH estoque AS (
  SELECT e.empresa_par AS empresa,
         e.cod_produto,
         SUM(COALESCE(e.saldo, 0)) AS saldo_total,
         SUM(COALESCE(e.custo_total, 0)) AS custo_total
    FROM public.erp_estoque_distribuidora e
   WHERE e.cod_produto IS NOT NULL
     AND e.empresa_par IS NOT NULL
   GROUP BY e.empresa_par, e.cod_produto
),
classificado AS (
  SELECT es.empresa,
         es.cod_produto,
         es.saldo_total,
         es.custo_total,
         n.nivel,
         COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
    FROM estoque es
    LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
),
agg AS (
  SELECT
    c.empresa,
    c.produto_raiz,
    SUM(CASE WHEN c.nivel = 1 THEN c.saldo_total ELSE 0 END) AS saldo_em_caixas,
    SUM(CASE WHEN c.nivel = 2 THEN c.saldo_total ELSE 0 END) AS saldo_em_displays,
    SUM(CASE WHEN c.nivel = 3 THEN c.saldo_total ELSE 0 END) AS saldo_em_unidades,
    COALESCE(SUM(c.saldo_total * COALESCE((
      SELECT MAX(p.fator_acumulado)
        FROM public.vw_bom_path p
       WHERE p.empresa = c.empresa
         AND p.raiz_cod = c.produto_raiz
         AND p.folha_cod = c.cod_produto
    ), 1)), 0) AS saldo_total_em_unidades,
    SUM(c.custo_total) AS custo_total,
    COUNT(DISTINCT c.cod_produto) AS skus_envolvidos
  FROM classificado c
  GROUP BY c.empresa, c.produto_raiz
),
fatores AS (
  -- fator CX (nivel 1) -> UN (nivel 3) = max(fator_acumulado) entre raiz e folha de nivel 3
  SELECT a.empresa,
         a.produto_raiz,
         (SELECT MAX(p.fator_acumulado)
            FROM public.vw_bom_path p
            JOIN public.estoque_produto_nivel nf ON nf.cod_produto = p.folha_cod
           WHERE p.empresa = a.empresa
             AND p.raiz_cod = a.produto_raiz
             AND nf.nivel = 3) AS fator_cx_para_un,
         -- fator BX (nivel 2) -> UN (nivel 3): pega caminhos que partem de filhos diretos da raiz que sao nivel 2
         (SELECT MAX(p.fator_acumulado)
            FROM public.vw_bom_path p
            JOIN public.estoque_produto_nivel n2 ON n2.cod_produto = ANY(p.caminho)
            JOIN public.estoque_produto_nivel nf ON nf.cod_produto = p.folha_cod
           WHERE p.empresa = a.empresa
             AND p.raiz_cod = a.produto_raiz
             AND n2.nivel = 2
             AND nf.nivel = 3) AS fator_bx_para_un
  FROM agg a
)
SELECT
  a.empresa,
  a.produto_raiz,
  a.saldo_em_caixas,
  a.saldo_em_displays,
  a.saldo_em_unidades,
  a.saldo_total_em_unidades,
  a.custo_total,
  a.skus_envolvidos,
  f.fator_cx_para_un,
  f.fator_bx_para_un,
  fp.codigo_barras_ean AS ean_raiz
FROM agg a
LEFT JOIN fatores f
  ON f.empresa = a.empresa AND f.produto_raiz = a.produto_raiz
LEFT JOIN public.fabrica_produtos fp
  ON fp.codigo = a.produto_raiz::text;