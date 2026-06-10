CREATE OR REPLACE FUNCTION public.estoque_unificado_bom_complemento(p_empresa integer, p_raiz integer)
 RETURNS TABLE(empresa integer, produto_raiz integer, cod_produto integer, nome_prod text, abrev_par text, codigo_barras_ean text, nivel integer, pai_cod integer, fator_pai_para_filho numeric, fator_un_acumulado numeric, saldo numeric, bloqueado numeric, pendente numeric, disponivel numeric, custo_total numeric, contribuicao_un numeric, contribuicao_bloqueado_un numeric, contribuicao_disponivel_un numeric, contribuicao_pendente_un numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE descendentes AS (
    SELECT
      b.pai_cod   AS pai_cod,
      b.filho_cod AS cod_produto,
      b.quantidade AS fator_pai_para_filho,
      1 AS profundidade
    FROM bom_edges b
    WHERE b.ativo = true
      AND b.pai_cod = p_raiz
    UNION ALL
    SELECT
      b.pai_cod,
      b.filho_cod,
      b.quantidade,
      d.profundidade + 1
    FROM bom_edges b
    JOIN descendentes d ON d.cod_produto = b.pai_cod
    WHERE b.ativo = true
      AND d.profundidade < 6
  ),
  fator_desc AS (
    SELECT DISTINCT b.filho_cod AS sku, 1::numeric AS fator
    FROM bom_edges b
    WHERE b.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM bom_edges b2
        WHERE b2.ativo = true AND b2.pai_cod = b.filho_cod
      )
    UNION ALL
    SELECT b.pai_cod, b.quantidade * fd.fator
    FROM bom_edges b
    JOIN fator_desc fd ON fd.sku = b.filho_cod
    WHERE b.ativo = true
  ),
  fator_por_sku AS (
    SELECT sku, max(fator) AS fator_un FROM fator_desc GROUP BY sku
  ),
  desc_uniq AS (
    SELECT DISTINCT ON (cod_produto) cod_produto, pai_cod, fator_pai_para_filho
    FROM descendentes
    ORDER BY cod_produto, profundidade ASC
  ),
  -- Inclui o próprio produto-raiz como nó âncora (pai_cod NULL) para que o
  -- frontend consiga montar a árvore mesmo quando a CX raiz não tem saldo na
  -- filial consultada (e portanto não aparece em vw_estoque_unificado_skus).
  nos_total AS (
    SELECT cod_produto, pai_cod, fator_pai_para_filho FROM desc_uniq
    UNION ALL
    SELECT p_raiz::int AS cod_produto, NULL::int AS pai_cod, NULL::numeric AS fator_pai_para_filho
    WHERE NOT EXISTS (SELECT 1 FROM desc_uniq d WHERE d.cod_produto = p_raiz)
  ),
  estoque_emp AS (
    SELECT
      e.cod_produto,
      SUM(COALESCE(e.saldo, 0))::numeric AS saldo,
      SUM(COALESCE(e.estoque_bloqueado_produto, 0) + COALESCE(e.estoque_bloqueado_endereco, 0))::numeric AS bloqueado,
      SUM(COALESCE(e.pedido_pendente, 0))::numeric AS pendente
    FROM erp_estoque_distribuidora e
    WHERE e.empresa_par = p_empresa
      AND e.cod_produto IS NOT NULL
    GROUP BY e.cod_produto
  ),
  nome_qualquer_filial AS (
    SELECT cod_produto, MAX(nome_prod) AS nome_prod
    FROM erp_estoque_distribuidora
    WHERE cod_produto IS NOT NULL AND nome_prod IS NOT NULL
    GROUP BY cod_produto
  )
  SELECT
    p_empresa::int                                                AS empresa,
    p_raiz::int                                                   AS produto_raiz,
    d.cod_produto::int                                            AS cod_produto,
    COALESCE(fp.nome, nq.nome_prod)::text                         AS nome_prod,
    NULL::text                                                    AS abrev_par,
    fp.codigo_barras_ean::text                                    AS codigo_barras_ean,
    COALESCE(n.nivel, CASE WHEN d.cod_produto = p_raiz THEN 1 ELSE NULL END)::int AS nivel,
    d.pai_cod::int                                                AS pai_cod,
    d.fator_pai_para_filho                                        AS fator_pai_para_filho,
    COALESCE(fps.fator_un, 1::numeric)                            AS fator_un_acumulado,
    COALESCE(ee.saldo, 0)::numeric                                AS saldo,
    COALESCE(ee.bloqueado, 0)::numeric                            AS bloqueado,
    COALESCE(ee.pendente, 0)::numeric                             AS pendente,
    GREATEST(COALESCE(ee.saldo, 0) - COALESCE(ee.bloqueado, 0), 0)::numeric AS disponivel,
    0::numeric                                                    AS custo_total,
    (COALESCE(ee.saldo, 0) * COALESCE(fps.fator_un, 1))::numeric  AS contribuicao_un,
    (COALESCE(ee.bloqueado, 0) * COALESCE(fps.fator_un, 1))::numeric AS contribuicao_bloqueado_un,
    (GREATEST(COALESCE(ee.saldo, 0) - COALESCE(ee.bloqueado, 0), 0) * COALESCE(fps.fator_un, 1))::numeric AS contribuicao_disponivel_un,
    (COALESCE(ee.pendente, 0) * COALESCE(fps.fator_un, 1))::numeric AS contribuicao_pendente_un
  FROM nos_total d
  LEFT JOIN estoque_produto_nivel n  ON n.cod_produto = d.cod_produto
  LEFT JOIN fator_por_sku fps        ON fps.sku       = d.cod_produto
  LEFT JOIN fabrica_produtos fp      ON fp.codigo::text = d.cod_produto::text
  LEFT JOIN estoque_emp ee           ON ee.cod_produto = d.cod_produto
  LEFT JOIN nome_qualquer_filial nq  ON nq.cod_produto = d.cod_produto;
$function$;

GRANT EXECUTE ON FUNCTION public.estoque_unificado_bom_complemento(integer, integer) TO authenticated;