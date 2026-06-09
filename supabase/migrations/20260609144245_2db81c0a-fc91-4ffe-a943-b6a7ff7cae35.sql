DROP VIEW IF EXISTS public.vw_estoque_unificado_skus;
CREATE VIEW public.vw_estoque_unificado_skus AS
WITH RECURSIVE fator_desc AS (
  SELECT DISTINCT b.filho_cod AS sku, 1::numeric AS fator
  FROM public.bom_edges b
  WHERE b.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM public.bom_edges b2
      WHERE b2.ativo = true AND b2.pai_cod = b.filho_cod
    )
  UNION ALL
  SELECT b.pai_cod, (b.quantidade * fd.fator)::numeric
  FROM public.bom_edges b
  JOIN fator_desc fd ON fd.sku = b.filho_cod
  WHERE b.ativo = true
),
fator_por_sku AS (
  SELECT sku, MAX(fator) AS fator_un
  FROM fator_desc
  GROUP BY sku
),
estoque AS (
  SELECT e.empresa_par AS empresa,
         e.cod_produto,
         MAX(e.nome_prod) AS nome_prod,
         MAX(e.abrev_par) AS abrev_par,
         SUM(COALESCE(e.saldo, 0))                     AS saldo,
         SUM(COALESCE(e.estoque_bloqueado_produto, 0)) AS bloqueado,
         SUM(COALESCE(e.pedido_pendente, 0))           AS pendente,
         SUM(COALESCE(e.custo_total, 0))               AS custo_total
  FROM public.erp_estoque_distribuidora e
  WHERE e.cod_produto IS NOT NULL AND e.empresa_par IS NOT NULL
  GROUP BY e.empresa_par, e.cod_produto
),
classificado AS (
  SELECT es.empresa, es.cod_produto, es.nome_prod, es.abrev_par,
         es.saldo, es.bloqueado, es.pendente, es.custo_total,
         GREATEST(es.saldo - es.bloqueado, 0) AS disponivel,
         n.nivel,
         COALESCE(n.produto_raiz, es.cod_produto) AS produto_raiz
  FROM estoque es
  LEFT JOIN public.estoque_produto_nivel n ON n.cod_produto = es.cod_produto
),
-- Arestas com a raiz do pai (para preferir o pai que esteja na mesma árvore-raiz do filho)
pai_candidatos AS (
  SELECT be.filho_cod,
         be.pai_cod,
         be.quantidade,
         be.updated_at,
         COALESCE(npa.produto_raiz, be.pai_cod) AS raiz_do_pai
  FROM public.bom_edges be
  LEFT JOIN public.estoque_produto_nivel npa ON npa.cod_produto = be.pai_cod
  WHERE be.ativo = true
),
-- Pai por (filho, raiz_do_pai): escolha contextual à árvore exibida
pai_por_raiz AS (
  SELECT DISTINCT ON (pc.filho_cod, pc.raiz_do_pai)
         pc.filho_cod, pc.raiz_do_pai, pc.pai_cod, pc.quantidade
  FROM pai_candidatos pc
  ORDER BY pc.filho_cod, pc.raiz_do_pai, pc.updated_at DESC
),
-- Fallback: pai mais recente (comportamento legado)
pai_fallback AS (
  SELECT DISTINCT ON (be.filho_cod) be.filho_cod, be.pai_cod, be.quantidade
  FROM public.bom_edges be
  WHERE be.ativo = true
  ORDER BY be.filho_cod, be.updated_at DESC
)
SELECT c.empresa,
       c.produto_raiz,
       c.cod_produto,
       c.nome_prod,
       c.abrev_par,
       fp.codigo_barras_ean,
       c.nivel,
       COALESCE(ppr.pai_cod,    pf.pai_cod)    AS pai_cod,
       COALESCE(ppr.quantidade, pf.quantidade) AS fator_pai_para_filho,
       COALESCE(fps.fator_un, 1) AS fator_un_acumulado,
       c.saldo,
       c.bloqueado,
       c.pendente,
       c.disponivel,
       c.custo_total,
       c.saldo      * COALESCE(fps.fator_un, 1) AS contribuicao_un,
       c.bloqueado  * COALESCE(fps.fator_un, 1) AS contribuicao_bloqueado_un,
       c.disponivel * COALESCE(fps.fator_un, 1) AS contribuicao_disponivel_un,
       c.pendente   * COALESCE(fps.fator_un, 1) AS contribuicao_pendente_un
FROM classificado c
LEFT JOIN fator_por_sku fps ON fps.sku = c.cod_produto
LEFT JOIN pai_por_raiz ppr  ON ppr.filho_cod = c.cod_produto AND ppr.raiz_do_pai = c.produto_raiz
LEFT JOIN pai_fallback pf   ON pf.filho_cod  = c.cod_produto
LEFT JOIN public.fabrica_produtos fp ON fp.codigo::text = c.cod_produto::text;

GRANT SELECT ON public.vw_estoque_unificado_skus TO authenticated;