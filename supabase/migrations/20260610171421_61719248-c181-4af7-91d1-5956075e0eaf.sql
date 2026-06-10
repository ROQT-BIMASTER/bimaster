
CREATE OR REPLACE FUNCTION public.estoque_unificado_bom_complemento(p_empresa integer, p_raiz integer)
 RETURNS TABLE(empresa integer, produto_raiz integer, cod_produto integer, nome_prod text, abrev_par text, codigo_barras_ean text, nivel integer, pai_cod integer, fator_pai_para_filho numeric, fator_un_acumulado numeric, saldo numeric, bloqueado numeric, pendente numeric, disponivel numeric, custo_total numeric, contribuicao_un numeric, contribuicao_bloqueado_un numeric, contribuicao_disponivel_un numeric, contribuicao_pendente_un numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE descendentes AS (
    SELECT b.pai_cod, b.filho_cod AS cod_produto, b.quantidade AS fator_pai_para_filho, 1 AS profundidade
    FROM bom_edges b
    WHERE b.ativo = true AND b.pai_cod = p_raiz
    UNION ALL
    SELECT b.pai_cod, b.filho_cod, b.quantidade, d.profundidade + 1
    FROM bom_edges b
    JOIN descendentes d ON d.cod_produto = b.pai_cod
    WHERE b.ativo = true AND d.profundidade < 6
  ),
  fator_desc AS (
    SELECT DISTINCT b.filho_cod AS sku, 1::numeric AS fator
    FROM bom_edges b
    WHERE b.ativo = true
      AND NOT EXISTS (SELECT 1 FROM bom_edges b2 WHERE b2.ativo = true AND b2.pai_cod = b.filho_cod)
    UNION ALL
    SELECT b.pai_cod, b.quantidade * fd.fator
    FROM bom_edges b
    JOIN fator_desc fd ON fd.sku = b.filho_cod
    WHERE b.ativo = true
  ),
  fator_por_sku AS (SELECT sku, max(fator) AS fator_un FROM fator_desc GROUP BY sku),
  desc_uniq AS (
    SELECT DISTINCT ON (cod_produto) cod_produto, pai_cod, fator_pai_para_filho
    FROM descendentes
    ORDER BY cod_produto, profundidade ASC
  ),
  nos_total AS (
    SELECT cod_produto, pai_cod, fator_pai_para_filho FROM desc_uniq
    UNION ALL
    SELECT p_raiz::int, NULL::int, NULL::numeric
    WHERE NOT EXISTS (SELECT 1 FROM desc_uniq d WHERE d.cod_produto = p_raiz)
  ),
  estoque_emp AS (
    SELECT e.cod_produto,
      SUM(COALESCE(e.saldo, 0))::numeric AS saldo,
      SUM(COALESCE(e.estoque_bloqueado_produto, 0) + COALESCE(e.estoque_bloqueado_endereco, 0))::numeric AS bloqueado,
      SUM(COALESCE(e.pedido_pendente, 0))::numeric AS pendente
    FROM erp_estoque_distribuidora e
    WHERE e.empresa_par = p_empresa AND e.cod_produto IS NOT NULL
    GROUP BY e.cod_produto
  ),
  nome_erp AS (
    SELECT cod_produto, MAX(NULLIF(btrim(nome_prod), '')) AS nome_prod
    FROM erp_estoque_distribuidora WHERE cod_produto IS NOT NULL GROUP BY cod_produto
  ),
  nome_fab AS (
    SELECT cod_produto, MAX(nome) AS nome
    FROM (
      SELECT NULLIF(fp.codigo, '')::int AS cod_produto,
             COALESCE(NULLIF(btrim(fp.nome_comercial),''),NULLIF(btrim(fp.nome),''),NULLIF(btrim(fp.descricao_curta),''),NULLIF(btrim(fp.descricao),'')) AS nome
      FROM fabrica_produtos fp WHERE fp.codigo ~ '^[0-9]+$'
      UNION ALL
      SELECT NULLIF(fp.codigo_erp,'')::int,
             COALESCE(NULLIF(btrim(fp.nome_comercial),''),NULLIF(btrim(fp.nome),''),NULLIF(btrim(fp.descricao_curta),''),NULLIF(btrim(fp.descricao),''))
      FROM fabrica_produtos fp WHERE fp.codigo_erp ~ '^[0-9]+$'
      UNION ALL
      SELECT NULLIF(fp.sku,'')::int,
             COALESCE(NULLIF(btrim(fp.nome_comercial),''),NULLIF(btrim(fp.nome),''),NULLIF(btrim(fp.descricao_curta),''),NULLIF(btrim(fp.descricao),''))
      FROM fabrica_produtos fp WHERE fp.sku ~ '^[0-9]+$'
    ) s WHERE cod_produto IS NOT NULL AND nome IS NOT NULL GROUP BY cod_produto
  ),
  nome_master AS (
    SELECT NULLIF(sku_master,'')::int AS cod_produto,
           MAX(COALESCE(NULLIF(btrim(nome),''),NULLIF(btrim(descricao),''))) AS nome
    FROM estoque_produtos_master WHERE sku_master ~ '^[0-9]+$' GROUP BY NULLIF(sku_master,'')::int
  ),
  base AS (
    SELECT d.cod_produto, d.pai_cod, d.fator_pai_para_filho,
      COALESCE(NULLIF(btrim(ne.nome_prod),''),NULLIF(btrim(nf.nome),''),NULLIF(btrim(nm.nome),'')) AS nome_direto
    FROM nos_total d
    LEFT JOIN nome_erp ne    ON ne.cod_produto = d.cod_produto
    LEFT JOIN nome_fab nf    ON nf.cod_produto = d.cod_produto
    LEFT JOIN nome_master nm ON nm.cod_produto = d.cod_produto
  ),
  com_inferencia AS (
    SELECT b.cod_produto, b.pai_cod, b.fator_pai_para_filho,
      COALESCE(
        b.nome_direto,
        CASE WHEN bp.nome_direto IS NOT NULL THEN
          regexp_replace(
            regexp_replace(bp.nome_direto, '^[[:space:]]*BX[[:space:]]+', '', 'i'),
            'BX([[:space:]]|$)', '\1', 'g'
          )
        END
      ) AS nome_prod
    FROM base b LEFT JOIN base bp ON bp.cod_produto = b.pai_cod
  )
  SELECT
    p_empresa::int, p_raiz::int, ci.cod_produto::int,
    ci.nome_prod::text, NULL::text, fp.codigo_barras_ean::text,
    COALESCE(n.nivel, CASE WHEN ci.cod_produto = p_raiz THEN 1 ELSE NULL END)::int,
    ci.pai_cod::int, ci.fator_pai_para_filho, COALESCE(fps.fator_un, 1::numeric),
    COALESCE(ee.saldo, 0)::numeric, COALESCE(ee.bloqueado, 0)::numeric, COALESCE(ee.pendente, 0)::numeric,
    GREATEST(COALESCE(ee.saldo, 0) - COALESCE(ee.bloqueado, 0), 0)::numeric, 0::numeric,
    (COALESCE(ee.saldo, 0) * COALESCE(fps.fator_un, 1))::numeric,
    (COALESCE(ee.bloqueado, 0) * COALESCE(fps.fator_un, 1))::numeric,
    (GREATEST(COALESCE(ee.saldo, 0) - COALESCE(ee.bloqueado, 0), 0) * COALESCE(fps.fator_un, 1))::numeric,
    (COALESCE(ee.pendente, 0) * COALESCE(fps.fator_un, 1))::numeric
  FROM com_inferencia ci
  LEFT JOIN estoque_produto_nivel n  ON n.cod_produto = ci.cod_produto
  LEFT JOIN fator_por_sku fps        ON fps.sku       = ci.cod_produto
  LEFT JOIN fabrica_produtos fp      ON fp.codigo::text = ci.cod_produto::text
  LEFT JOIN estoque_emp ee           ON ee.cod_produto = ci.cod_produto;
$function$;

GRANT EXECUTE ON FUNCTION public.estoque_unificado_bom_complemento(integer, integer) TO authenticated;
