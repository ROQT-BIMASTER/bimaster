DROP VIEW IF EXISTS public.vw_estoque_unificado_skus;

CREATE VIEW public.vw_estoque_unificado_skus
WITH (security_invoker = true)
AS
WITH RECURSIVE fator_desc AS (
  SELECT DISTINCT c.materia_compo AS sku, 1::numeric AS fator
  FROM public.erp_composicao_produto c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.erp_composicao_produto c2
    WHERE c2.produto_compo = c.materia_compo
  )
  UNION ALL
  SELECT c.produto_compo,
         (GREATEST(COALESCE(c.quantidade_compo, 1), 1) * fd.fator)::numeric
  FROM public.erp_composicao_produto c
  JOIN fator_desc fd ON fd.sku = c.materia_compo
),
fator_por_sku AS (
  SELECT sku, MAX(fator)::numeric AS fator_un
  FROM fator_desc
  GROUP BY sku
),
estoque AS (
  SELECT e.empresa_par AS empresa,
         e.cod_produto,
         MAX(e.nome_prod) AS nome_prod,
         MAX(e.abrev_par) AS abrev_par,
         SUM(COALESCE(e.saldo, 0)) AS saldo,
         SUM(COALESCE(e.custo_total, 0)) AS custo_total,
         SUM(COALESCE(e.estoque_bloqueado_produto, 0)) AS bloqueado,
         SUM(COALESCE(e.pedido_pendente, 0)) AS pendente
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
  GROUP BY e.empresa_par, e.cod_produto
),
classificado AS (
  SELECT es.empresa, es.cod_produto, es.nome_prod, es.abrev_par,
         es.saldo, es.custo_total, es.bloqueado, es.pendente,
         GREATEST(es.saldo - es.bloqueado, 0) AS disponivel,
         n.nivel,
         COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
  FROM estoque es
  LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
),
pai_de AS (
  SELECT DISTINCT ON (c.materia_compo)
         c.materia_compo AS filho_cod,
         c.produto_compo AS pai_cod,
         GREATEST(COALESCE(c.quantidade_compo, 1), 1) AS quantidade
  FROM public.erp_composicao_produto c
  ORDER BY c.materia_compo, c.sincronizado_em DESC NULLS LAST
)
SELECT c.empresa,
       c.produto_raiz,
       c.cod_produto,
       c.nome_prod,
       c.abrev_par,
       fp.codigo_barras_ean,
       c.nivel,
       pd.pai_cod,
       pd.quantidade AS fator_pai_para_filho,
       COALESCE(fps.fator_un, 1)::numeric AS fator_un_acumulado,
       c.saldo,
       c.bloqueado,
       c.pendente,
       c.disponivel,
       c.custo_total,
       (c.saldo      * COALESCE(fps.fator_un, 1))::numeric AS contribuicao_un,
       (c.bloqueado  * COALESCE(fps.fator_un, 1))::numeric AS contribuicao_bloqueado_un,
       (c.disponivel * COALESCE(fps.fator_un, 1))::numeric AS contribuicao_disponivel_un,
       (c.pendente   * COALESCE(fps.fator_un, 1))::numeric AS contribuicao_pendente_un
FROM classificado c
LEFT JOIN fator_por_sku fps ON fps.sku = c.cod_produto
LEFT JOIN pai_de pd ON pd.filho_cod = c.cod_produto
LEFT JOIN public.fabrica_produtos fp ON fp.codigo::text = c.cod_produto::text;

GRANT SELECT ON public.vw_estoque_unificado_skus TO authenticated;
GRANT SELECT ON public.vw_estoque_unificado_skus TO service_role;