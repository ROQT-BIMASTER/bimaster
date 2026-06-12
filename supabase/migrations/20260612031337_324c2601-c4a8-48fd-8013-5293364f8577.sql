
-- Fix double-count in consolidated Cores KPIs and consolidated list.
-- Uses best_leaf (DISTINCT ON ancestor by MAX fator) so each SKU's stock
-- is attributed to ONE canonical leaf — same math as rpc_estoque_cores_kpis
-- and vw_conciliacao_cores_unificado, guaranteeing the totals match.

CREATE OR REPLACE FUNCTION public.rpc_estoque_cores_kpis_consolidado(
  p_empresas integer[] DEFAULT NULL::integer[],
  p_linhas text[] DEFAULT NULL::text[],
  p_campanha_ids uuid[] DEFAULT NULL::uuid[],
  p_busca text DEFAULT NULL::text,
  p_apenas_com_saldo boolean DEFAULT false,
  p_com_pedido_pendente boolean DEFAULT false,
  p_curva_fisica text[] DEFAULT NULL::text[],
  p_curva_monetaria text[] DEFAULT NULL::text[],
  p_incluir_potencial boolean DEFAULT true
)
RETURNS TABLE(
  total_skus bigint,
  total_unidades numeric,
  total_unidades_potencial numeric,
  total_pedido_pendente numeric,
  itens_sem_saldo bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
  v_empresas integer[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  v_is_admin := has_role(v_user,'admin'::app_role) OR has_role(v_user,'gerente'::app_role);
  IF v_is_admin THEN
    SELECT array_agg(DISTINCT e.empresa_par) INTO v_empresas
    FROM erp_estoque_distribuidora e WHERE e.empresa_par IS NOT NULL;
  ELSE
    SELECT array_agg(DISTINCT ue.empresa_id) INTO v_empresas
    FROM user_empresas ue WHERE ue.user_id = v_user;
  END IF;
  IF v_empresas IS NULL THEN v_empresas := ARRAY[]::integer[]; END IF;
  IF p_empresas IS NOT NULL AND array_length(p_empresas,1)>0 THEN
    v_empresas := ARRAY(SELECT unnest(v_empresas) INTERSECT SELECT unnest(p_empresas));
  END IF;

  RETURN QUERY
  WITH RECURSIVE
  folhas AS (
    SELECT DISTINCT c.materia_compo AS cod_folha
    FROM erp_composicao_produto c
    WHERE NOT EXISTS (SELECT 1 FROM erp_composicao_produto c2 WHERE c2.produto_compo = c.materia_compo)
  ),
  path AS (
    SELECT f.cod_folha, f.cod_folha AS cod_ancestor, 1::numeric AS fator, 0 AS depth,
           ARRAY[f.cod_folha]::integer[] AS visited
    FROM folhas f
    UNION ALL
    SELECT p.cod_folha, c.produto_compo,
           p.fator * GREATEST(COALESCE(c.quantidade_compo,1)::numeric, 1::numeric),
           p.depth + 1,
           p.visited || c.produto_compo
    FROM path p
    JOIN erp_composicao_produto c ON c.materia_compo = p.cod_ancestor
    WHERE p.depth < 6 AND NOT (c.produto_compo = ANY(p.visited))
  ),
  best_leaf AS (
    SELECT DISTINCT ON (cod_ancestor)
           cod_ancestor AS cod_produto, cod_folha, fator
    FROM path
    ORDER BY cod_ancestor, fator DESC, cod_folha
  ),
  saldos AS (
    SELECT e.empresa_par, e.cod_produto, COALESCE(e.saldo,0)::numeric AS saldo
    FROM erp_estoque_distribuidora e
    WHERE e.empresa_par = ANY(v_empresas)
  ),
  mapa AS (
    SELECT s.empresa_par,
           s.cod_produto AS cod_sku,
           COALESCE(bl.cod_folha, s.cod_produto) AS cod_folha,
           COALESCE(bl.fator, 1::numeric) AS fator,
           s.saldo
    FROM saldos s
    LEFT JOIN best_leaf bl ON bl.cod_produto = s.cod_produto
  ),
  contrib AS (
    SELECT m.cod_folha AS cod_produto,
           SUM(CASE WHEN m.cod_sku = m.cod_folha THEN m.saldo ELSE 0 END) AS saldo_proprio,
           SUM(CASE WHEN m.cod_sku <> m.cod_folha THEN m.saldo * m.fator ELSE 0 END) AS saldo_potencial
    FROM mapa m
    GROUP BY 1
  ),
  meta AS (
    SELECT DISTINCT ON (e.cod_produto)
           e.cod_produto,
           e.nome_linha, e.curva_fisica, e.curva_monetaria,
           e.nome_prod, e.cod_fabricante
    FROM erp_estoque_distribuidora e
    WHERE e.empresa_par = ANY(v_empresas)
    ORDER BY e.cod_produto
  ),
  ped AS (
    SELECT e.cod_produto, SUM(COALESCE(e.pedido_pendente,0))::numeric AS pedido_pendente
    FROM erp_estoque_distribuidora e
    WHERE e.empresa_par = ANY(v_empresas)
    GROUP BY e.cod_produto
  ),
  base AS (
    SELECT c.cod_produto,
           c.saldo_proprio, c.saldo_potencial,
           m.nome_linha, m.curva_fisica, m.curva_monetaria,
           m.nome_prod, m.cod_fabricante,
           COALESCE(p.pedido_pendente,0) AS pedido_pendente
    FROM contrib c
    LEFT JOIN meta m ON m.cod_produto = c.cod_produto
    LEFT JOIN ped p ON p.cod_produto = c.cod_produto
  ),
  f AS (
    SELECT * FROM base b
    WHERE (p_linhas IS NULL OR b.nome_linha = ANY(p_linhas))
      AND (p_curva_fisica IS NULL OR b.curva_fisica = ANY(p_curva_fisica))
      AND (p_curva_monetaria IS NULL OR b.curva_monetaria = ANY(p_curva_monetaria))
      AND (NOT p_com_pedido_pendente OR b.pedido_pendente > 0)
      AND (p_busca IS NULL OR p_busca = '' OR
           b.nome_prod ILIKE '%'||p_busca||'%' OR
           b.cod_fabricante ILIKE '%'||p_busca||'%' OR
           b.cod_produto::text = p_busca)
      AND (p_campanha_ids IS NULL OR EXISTS (
            SELECT 1 FROM estoque_etiqueta_produtos ep
            WHERE ep.cod_produto = b.cod_produto AND ep.etiqueta_id = ANY(p_campanha_ids)
      ))
      AND (NOT p_apenas_com_saldo OR
           (CASE WHEN p_incluir_potencial THEN b.saldo_proprio + b.saldo_potencial ELSE b.saldo_proprio END) > 0)
  )
  SELECT
    COUNT(*)::bigint,
    SUM(CASE WHEN p_incluir_potencial THEN f.saldo_proprio + f.saldo_potencial ELSE f.saldo_proprio END)::numeric,
    SUM(f.saldo_potencial)::numeric,
    SUM(f.pedido_pendente)::numeric,
    COUNT(*) FILTER (WHERE (CASE WHEN p_incluir_potencial THEN f.saldo_proprio + f.saldo_potencial ELSE f.saldo_proprio END) <= 0)::bigint
  FROM f;
END
$function$;


CREATE OR REPLACE FUNCTION public.rpc_estoque_cores_consolidado(
  p_empresas integer[] DEFAULT NULL::integer[],
  p_linhas text[] DEFAULT NULL::text[],
  p_campanha_ids uuid[] DEFAULT NULL::uuid[],
  p_busca text DEFAULT NULL::text,
  p_apenas_com_saldo boolean DEFAULT false,
  p_com_pedido_pendente boolean DEFAULT false,
  p_curva_fisica text[] DEFAULT NULL::text[],
  p_curva_monetaria text[] DEFAULT NULL::text[],
  p_incluir_potencial boolean DEFAULT true,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_order_by text DEFAULT 'saldo_total_disponivel'::text,
  p_order_dir text DEFAULT 'desc'::text,
  p_apenas_divergencia_linha boolean DEFAULT false
)
RETURNS TABLE(
  cod_produto integer, cod_fabricante text, nome_prod text, nome_linha text,
  unidade_medida text, curva_fisica text, curva_monetaria text,
  qtd_empresas integer,
  saldo_proprio numeric, saldo_potencial_desmontagem numeric, saldo_total_disponivel numeric,
  pedido_pendente numeric,
  estoque_endereco numeric, estoque_bloqueado_produto numeric, estoque_bloqueado_endereco numeric,
  por_empresa jsonb, total_count bigint,
  tem_divergencia_linha boolean, linhas_divergentes text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
  v_empresas integer[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  v_is_admin := has_role(v_user,'admin'::app_role) OR has_role(v_user,'gerente'::app_role);
  IF v_is_admin THEN
    SELECT array_agg(DISTINCT e.empresa_par) INTO v_empresas
    FROM erp_estoque_distribuidora e WHERE e.empresa_par IS NOT NULL;
  ELSE
    SELECT array_agg(DISTINCT ue.empresa_id) INTO v_empresas
    FROM user_empresas ue WHERE ue.user_id = v_user;
  END IF;
  IF v_empresas IS NULL THEN v_empresas := ARRAY[]::integer[]; END IF;
  IF p_empresas IS NOT NULL AND array_length(p_empresas,1)>0 THEN
    v_empresas := ARRAY(SELECT unnest(v_empresas) INTERSECT SELECT unnest(p_empresas));
  END IF;

  RETURN QUERY
  WITH RECURSIVE
  folhas AS (
    SELECT DISTINCT c.materia_compo AS cod_folha
    FROM erp_composicao_produto c
    WHERE NOT EXISTS (SELECT 1 FROM erp_composicao_produto c2 WHERE c2.produto_compo = c.materia_compo)
  ),
  path AS (
    SELECT f.cod_folha, f.cod_folha AS cod_ancestor, 1::numeric AS fator, 0 AS depth,
           ARRAY[f.cod_folha]::integer[] AS visited
    FROM folhas f
    UNION ALL
    SELECT p.cod_folha, c.produto_compo,
           p.fator * GREATEST(COALESCE(c.quantidade_compo,1)::numeric,1::numeric),
           p.depth + 1,
           p.visited || c.produto_compo
    FROM path p
    JOIN erp_composicao_produto c ON c.materia_compo = p.cod_ancestor
    WHERE p.depth < 6 AND NOT (c.produto_compo = ANY(p.visited))
  ),
  best_leaf AS (
    SELECT DISTINCT ON (cod_ancestor)
           cod_ancestor AS cod_produto, cod_folha, fator
    FROM path
    ORDER BY cod_ancestor, fator DESC, cod_folha
  ),
  saldos AS (
    SELECT e.empresa_par, e.abrev_par, e.cod_produto,
           COALESCE(e.saldo,0)::numeric AS saldo,
           COALESCE(e.pedido_pendente,0)::numeric AS pedido_pendente,
           COALESCE(e.estoque_endereco,0)::numeric AS estoque_endereco,
           COALESCE(e.estoque_bloqueado_produto,0)::numeric AS estoque_bloqueado_produto,
           COALESCE(e.estoque_bloqueado_endereco,0)::numeric AS estoque_bloqueado_endereco,
           e.nome_prod, e.cod_fabricante, e.nome_linha, e.unidade_medida,
           e.curva_fisica, e.curva_monetaria
    FROM erp_estoque_distribuidora e
    WHERE e.empresa_par = ANY(v_empresas)
  ),
  mapa AS (
    SELECT s.empresa_par, s.abrev_par,
           s.cod_produto AS cod_sku,
           COALESCE(bl.cod_folha, s.cod_produto) AS cod_folha,
           COALESCE(bl.fator, 1::numeric) AS fator,
           s.saldo, s.pedido_pendente,
           s.estoque_endereco, s.estoque_bloqueado_produto, s.estoque_bloqueado_endereco,
           s.nome_prod
    FROM saldos s
    LEFT JOIN best_leaf bl ON bl.cod_produto = s.cod_produto
  ),
  -- Por (empresa, folha): saldo próprio (somente onde sku=folha) + saldo potencial (parentes rateados)
  contrib_emp AS (
    SELECT
      m.empresa_par, m.cod_folha AS cod_produto,
      MAX(m.abrev_par) FILTER (WHERE m.cod_sku = m.cod_folha) AS abrev_par,
      SUM(CASE WHEN m.cod_sku = m.cod_folha THEN m.saldo ELSE 0 END)::numeric AS saldo_proprio_v,
      SUM(CASE WHEN m.cod_sku <> m.cod_folha THEN m.saldo * m.fator ELSE 0 END)::numeric AS saldo_potencial_v,
      SUM(CASE WHEN m.cod_sku = m.cod_folha THEN m.pedido_pendente ELSE 0 END)::numeric AS pedido_pendente,
      SUM(CASE WHEN m.cod_sku = m.cod_folha THEN m.estoque_endereco ELSE 0 END)::numeric AS estoque_endereco,
      SUM(CASE WHEN m.cod_sku = m.cod_folha THEN m.estoque_bloqueado_produto ELSE 0 END)::numeric AS estoque_bloqueado_produto,
      SUM(CASE WHEN m.cod_sku = m.cod_folha THEN m.estoque_bloqueado_endereco ELSE 0 END)::numeric AS estoque_bloqueado_endereco,
      jsonb_agg(
        jsonb_build_object(
          'cod_pai', m.cod_sku,
          'nome_pai', m.nome_prod,
          'saldo_pai', m.saldo,
          'fator', m.fator,
          'contribuicao', m.saldo * m.fator
        ) ORDER BY (m.saldo * m.fator) DESC
      ) FILTER (WHERE m.cod_sku <> m.cod_folha AND m.saldo > 0) AS detalhe
    FROM mapa m
    GROUP BY m.empresa_par, m.cod_folha
  ),
  meta AS (
    SELECT DISTINCT ON (e.cod_produto)
      e.cod_produto, e.nome_prod, e.cod_fabricante, e.nome_linha,
      e.unidade_medida, e.curva_fisica, e.curva_monetaria
    FROM erp_estoque_distribuidora e
    WHERE e.empresa_par = ANY(v_empresas)
    ORDER BY e.cod_produto
  ),
  div_linhas AS (
    SELECT v.cod_produto, v.linhas_distintas FROM vw_divergencia_linha_erp v
  ),
  base AS (
    SELECT
      ce.empresa_par, ce.abrev_par, ce.cod_produto,
      m.cod_fabricante, m.nome_prod, m.nome_linha, m.unidade_medida, m.curva_fisica, m.curva_monetaria,
      ce.saldo_proprio_v, ce.saldo_potencial_v,
      ce.pedido_pendente, ce.estoque_endereco,
      ce.estoque_bloqueado_produto, ce.estoque_bloqueado_endereco,
      ce.detalhe
    FROM contrib_emp ce
    LEFT JOIN meta m ON m.cod_produto = ce.cod_produto
  ),
  filtrado AS (
    SELECT b.*, dl.linhas_distintas
    FROM base b
    LEFT JOIN div_linhas dl ON dl.cod_produto = b.cod_produto
    WHERE
      (p_linhas IS NULL OR b.nome_linha = ANY(p_linhas))
      AND (p_curva_fisica IS NULL OR b.curva_fisica = ANY(p_curva_fisica))
      AND (p_curva_monetaria IS NULL OR b.curva_monetaria = ANY(p_curva_monetaria))
      AND (NOT p_com_pedido_pendente OR b.pedido_pendente > 0)
      AND (NOT p_apenas_divergencia_linha OR dl.linhas_distintas IS NOT NULL)
      AND (
        p_busca IS NULL OR p_busca = ''
        OR b.nome_prod ILIKE '%'||p_busca||'%'
        OR b.cod_fabricante ILIKE '%'||p_busca||'%'
        OR b.cod_produto::text = p_busca
      )
      AND (
        p_campanha_ids IS NULL
        OR EXISTS (
          SELECT 1 FROM estoque_etiqueta_produtos ep
          WHERE ep.cod_produto = b.cod_produto AND ep.etiqueta_id = ANY(p_campanha_ids)
        )
      )
  ),
  agg AS (
    SELECT
      f.cod_produto,
      MAX(f.cod_fabricante) AS cod_fabricante,
      MAX(f.nome_prod) AS nome_prod,
      MAX(f.nome_linha) AS nome_linha,
      MAX(f.unidade_medida) AS unidade_medida,
      MAX(f.curva_fisica) AS curva_fisica,
      MAX(f.curva_monetaria) AS curva_monetaria,
      COUNT(DISTINCT f.empresa_par)::integer AS qtd_empresas,
      SUM(f.saldo_proprio_v) AS saldo_proprio,
      SUM(f.saldo_potencial_v) AS saldo_potencial,
      SUM(f.pedido_pendente) AS pedido_pendente,
      SUM(f.estoque_endereco) AS estoque_endereco,
      SUM(f.estoque_bloqueado_produto) AS estoque_bloqueado_produto,
      SUM(f.estoque_bloqueado_endereco) AS estoque_bloqueado_endereco,
      MAX(f.linhas_distintas) AS linhas_distintas,
      jsonb_agg(
        jsonb_build_object(
          'empresa_par', f.empresa_par,
          'abrev_par', f.abrev_par,
          'saldo_proprio', f.saldo_proprio_v,
          'saldo_potencial_desmontagem', f.saldo_potencial_v,
          'saldo_total_disponivel', f.saldo_proprio_v + f.saldo_potencial_v,
          'pedido_pendente', f.pedido_pendente,
          'estoque_endereco', f.estoque_endereco,
          'estoque_bloqueado_produto', f.estoque_bloqueado_produto,
          'estoque_bloqueado_endereco', f.estoque_bloqueado_endereco,
          'detalhe_desmontagem', f.detalhe,
          'nome_linha', f.nome_linha
        ) ORDER BY (f.saldo_proprio_v + f.saldo_potencial_v) DESC
      ) AS por_empresa
    FROM filtrado f
    GROUP BY f.cod_produto
  ),
  calc AS (
    SELECT
      a.*,
      CASE WHEN p_incluir_potencial
           THEN a.saldo_proprio + a.saldo_potencial
           ELSE a.saldo_proprio
      END AS saldo_total
    FROM agg a
    WHERE NOT p_apenas_com_saldo
       OR (CASE WHEN p_incluir_potencial
                THEN a.saldo_proprio + a.saldo_potencial
                ELSE a.saldo_proprio
           END) > 0
  ),
  counted AS (
    SELECT c.*, COUNT(*) OVER () AS _total FROM calc c
  )
  SELECT
    c.cod_produto, c.cod_fabricante, c.nome_prod, c.nome_linha,
    c.unidade_medida, c.curva_fisica, c.curva_monetaria,
    c.qtd_empresas,
    c.saldo_proprio,
    c.saldo_potencial AS saldo_potencial_desmontagem,
    c.saldo_total AS saldo_total_disponivel,
    c.pedido_pendente,
    c.estoque_endereco, c.estoque_bloqueado_produto, c.estoque_bloqueado_endereco,
    c.por_empresa,
    c._total AS total_count,
    (c.linhas_distintas IS NOT NULL) AS tem_divergencia_linha,
    c.linhas_distintas AS linhas_divergentes
  FROM counted c
  ORDER BY
    CASE WHEN p_order_by = 'nome_prod' AND p_order_dir = 'asc'  THEN c.nome_prod END ASC,
    CASE WHEN p_order_by = 'nome_prod' AND p_order_dir = 'desc' THEN c.nome_prod END DESC,
    CASE WHEN p_order_by = 'saldo' AND p_order_dir = 'asc'  THEN c.saldo_total END ASC,
    CASE WHEN p_order_by = 'saldo' AND p_order_dir = 'desc' THEN c.saldo_total END DESC,
    CASE WHEN p_order_by = 'saldo_total_disponivel' AND p_order_dir = 'asc'  THEN c.saldo_total END ASC,
    CASE WHEN p_order_by = 'saldo_total_disponivel' AND p_order_dir = 'desc' THEN c.saldo_total END DESC,
    CASE WHEN p_order_by = 'saldo_potencial_desmontagem' AND p_order_dir = 'desc' THEN c.saldo_potencial END DESC,
    CASE WHEN p_order_by = 'saldo_potencial_desmontagem' AND p_order_dir = 'asc'  THEN c.saldo_potencial END ASC,
    CASE WHEN p_order_by = 'pedido_pendente' AND p_order_dir = 'desc' THEN c.pedido_pendente END DESC,
    CASE WHEN p_order_by = 'pedido_pendente' AND p_order_dir = 'asc'  THEN c.pedido_pendente END ASC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END
$function$;
