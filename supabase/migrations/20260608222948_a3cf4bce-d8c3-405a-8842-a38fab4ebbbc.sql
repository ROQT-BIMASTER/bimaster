
CREATE OR REPLACE VIEW public.vw_estoque_unificado_skus
WITH (security_invoker = true) AS
WITH estoque AS (
  SELECT e.empresa_par AS empresa,
         e.cod_produto,
         max(e.nome_prod)  AS nome_prod,
         max(e.abrev_par)  AS abrev_par,
         sum(COALESCE(e.saldo, 0))        AS saldo,
         sum(COALESCE(e.custo_total, 0))  AS custo_total
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
  GROUP BY e.empresa_par, e.cod_produto
),
classificado AS (
  SELECT es.empresa,
         es.cod_produto,
         es.nome_prod,
         es.abrev_par,
         es.saldo,
         es.custo_total,
         n.nivel,
         COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
  FROM estoque es
  LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
),
folhas_un AS (
  SELECT DISTINCT ON (p.raiz_cod, p.folha_cod)
    p.raiz_cod,
    p.folha_cod,
    p.fator_acumulado AS fator_un,
    p.caminho[2]       AS mae_cod
  FROM public.vw_bom_path p
  JOIN public.estoque_produto_nivel nf
    ON nf.cod_produto = p.folha_cod AND nf.nivel = 3
  WHERE p.profundidade >= 1
  ORDER BY p.raiz_cod, p.folha_cod, p.profundidade DESC
),
pai_de AS (
  -- Aresta mais direta apontando para este filho (pai_cod, quantidade)
  SELECT DISTINCT ON (be.empresa, be.filho_cod)
         be.empresa, be.filho_cod, be.pai_cod, be.quantidade
  FROM public.bom_edges be
  WHERE be.ativo
  ORDER BY be.empresa, be.filho_cod, be.updated_at DESC
)
SELECT c.empresa,
       c.produto_raiz,
       c.cod_produto,
       c.nome_prod,
       c.abrev_par,
       fp.codigo_barras_ean,
       c.nivel,
       pd.pai_cod                       AS pai_cod,
       pd.quantidade                    AS fator_pai_para_filho,
       COALESCE(fu.fator_un, 1)         AS fator_un_acumulado,
       c.saldo,
       c.custo_total,
       (c.saldo * COALESCE(fu.fator_un, 1))::numeric AS contribuicao_un
FROM classificado c
LEFT JOIN folhas_un fu
       ON fu.raiz_cod = c.produto_raiz AND fu.folha_cod = c.cod_produto
LEFT JOIN pai_de pd
       ON pd.empresa = c.empresa AND pd.filho_cod = c.cod_produto
LEFT JOIN public.fabrica_produtos fp
       ON fp.codigo::text = c.cod_produto::text;

GRANT SELECT ON public.vw_estoque_unificado_skus TO authenticated;
GRANT SELECT ON public.vw_estoque_unificado_skus TO service_role;
