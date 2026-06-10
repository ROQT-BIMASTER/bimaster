CREATE OR REPLACE FUNCTION public.estoque_unificado_bom_complemento(
  p_empresa integer,
  p_raiz integer
)
RETURNS TABLE (
  empresa integer,
  produto_raiz integer,
  cod_produto integer,
  nome_prod text,
  abrev_par text,
  codigo_barras_ean text,
  nivel integer,
  pai_cod integer,
  fator_pai_para_filho numeric,
  fator_un_acumulado numeric,
  saldo numeric,
  bloqueado numeric,
  pendente numeric,
  disponivel numeric,
  custo_total numeric,
  contribuicao_un numeric,
  contribuicao_bloqueado_un numeric,
  contribuicao_disponivel_un numeric,
  contribuicao_pendente_un numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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
  no_estoque AS (
    SELECT DISTINCT e.cod_produto
    FROM erp_estoque_distribuidora e
    WHERE e.empresa_par = p_empresa
      AND e.cod_produto IS NOT NULL
  )
  SELECT
    p_empresa::int                                       AS empresa,
    p_raiz::int                                          AS produto_raiz,
    d.cod_produto::int                                   AS cod_produto,
    fp.nome::text                                        AS nome_prod,
    NULL::text                                           AS abrev_par,
    fp.codigo_barras_ean::text                           AS codigo_barras_ean,
    n.nivel::int                                         AS nivel,
    d.pai_cod::int                                       AS pai_cod,
    d.fator_pai_para_filho                               AS fator_pai_para_filho,
    COALESCE(fps.fator_un, 1::numeric)                   AS fator_un_acumulado,
    0::numeric                                           AS saldo,
    0::numeric                                           AS bloqueado,
    0::numeric                                           AS pendente,
    0::numeric                                           AS disponivel,
    0::numeric                                           AS custo_total,
    0::numeric                                           AS contribuicao_un,
    0::numeric                                           AS contribuicao_bloqueado_un,
    0::numeric                                           AS contribuicao_disponivel_un,
    0::numeric                                           AS contribuicao_pendente_un
  FROM (
    SELECT DISTINCT ON (cod_produto) cod_produto, pai_cod, fator_pai_para_filho
    FROM descendentes
    ORDER BY cod_produto, profundidade ASC
  ) d
  LEFT JOIN estoque_produto_nivel n ON n.cod_produto = d.cod_produto
  LEFT JOIN fator_por_sku fps       ON fps.sku       = d.cod_produto
  LEFT JOIN fabrica_produtos fp     ON fp.codigo::text = d.cod_produto::text
  WHERE d.cod_produto NOT IN (SELECT cod_produto FROM no_estoque);
$$;

GRANT EXECUTE ON FUNCTION public.estoque_unificado_bom_complemento(integer, integer) TO authenticated;