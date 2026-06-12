
-- ============================================================================
-- RPC de reconciliação Cores x Unificado
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_estoque_cores_vs_unificado(
  p_empresas integer[] DEFAULT NULL,
  p_linhas text[] DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_apenas_divergentes boolean DEFAULT false,
  p_tolerancia numeric DEFAULT 0.0001,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_order_by text DEFAULT 'delta_abs',
  p_order_dir text DEFAULT 'desc'
)
RETURNS TABLE (
  empresa integer,
  abrev_empresa text,
  cod_raiz integer,
  nome_raiz text,
  nome_linha text,
  qtd_cores integer,
  skus_unificado integer,
  un_cores numeric,
  un_unificado numeric,
  delta_un numeric,
  delta_pct numeric,
  fator_cx_para_un numeric,
  cx_cores numeric,
  cx_unificado numeric,
  disponivel_un_unificado numeric,
  bloqueado_un_unificado numeric,
  status text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_variable
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
  v_empresas integer[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  v_is_admin := has_role(v_user, 'admin'::app_role) OR has_role(v_user, 'gerente'::app_role);

  IF v_is_admin THEN
    SELECT array_agg(DISTINCT e.empresa_par) INTO v_empresas
    FROM erp_estoque_distribuidora e WHERE e.empresa_par IS NOT NULL;
  ELSE
    SELECT array_agg(DISTINCT ue.empresa_id) INTO v_empresas
    FROM user_empresas ue WHERE ue.user_id = v_user;
  END IF;

  IF v_empresas IS NULL THEN v_empresas := ARRAY[]::integer[]; END IF;

  IF p_empresas IS NOT NULL AND array_length(p_empresas, 1) > 0 THEN
    v_empresas := ARRAY(SELECT unnest(v_empresas) INTERSECT SELECT unnest(p_empresas));
  END IF;

  RETURN QUERY
  WITH RECURSIVE
  -- ---------- Lado Cores (replica a lógica da rpc_estoque_cores) ----------
  folhas AS (
    SELECT DISTINCT c.materia_compo AS cod_folha
    FROM erp_composicao_produto c
    WHERE NOT EXISTS (
      SELECT 1 FROM erp_composicao_produto c2 WHERE c2.produto_compo = c.materia_compo
    )
  ),
  caminhos AS (
    SELECT
      c.materia_compo AS cod_folha,
      c.produto_compo AS cod_ancestor,
      COALESCE(c.quantidade_compo, 1)::numeric AS fator,
      1 AS depth,
      ARRAY[c.materia_compo, c.produto_compo]::integer[] AS visited
    FROM erp_composicao_produto c
    JOIN folhas f ON f.cod_folha = c.materia_compo
    UNION ALL
    SELECT
      p.cod_folha,
      c.produto_compo,
      p.fator * COALESCE(c.quantidade_compo, 1)::numeric,
      p.depth + 1,
      p.visited || c.produto_compo
    FROM caminhos p
    JOIN erp_composicao_produto c ON c.materia_compo = p.cod_ancestor
    WHERE p.depth < 5 AND NOT (c.produto_compo = ANY(p.visited))
  ),
  saldo_folha AS (
    SELECT
      e.empresa_par AS empresa,
      e.cod_produto AS cod_folha,
      e.nome_prod,
      e.nome_linha,
      e.abrev_par,
      SUM(COALESCE(e.saldo, 0)) AS saldo_proprio
    FROM erp_estoque_distribuidora e
    JOIN folhas f ON f.cod_folha = e.cod_produto
    WHERE e.empresa_par = ANY(v_empresas)
    GROUP BY e.empresa_par, e.cod_produto, e.nome_prod, e.nome_linha, e.abrev_par
  ),
  potencial AS (
    SELECT
      ep.empresa_par AS empresa,
      cam.cod_folha,
      SUM(COALESCE(ep.saldo, 0) * cam.fator) AS saldo_potencial
    FROM (SELECT DISTINCT cod_folha, cod_ancestor, fator FROM caminhos) cam
    JOIN erp_estoque_distribuidora ep
      ON ep.cod_produto = cam.cod_ancestor
     AND ep.empresa_par = ANY(v_empresas)
    GROUP BY ep.empresa_par, cam.cod_folha
  ),
  cores_por_folha AS (
    SELECT
      COALESCE(sf.empresa, po.empresa) AS empresa,
      COALESCE(sf.cod_folha, po.cod_folha) AS cod_folha,
      sf.nome_prod,
      sf.nome_linha,
      sf.abrev_par,
      COALESCE(sf.saldo_proprio, 0) + COALESCE(po.saldo_potencial, 0) AS un_disponivel
    FROM saldo_folha sf
    FULL OUTER JOIN potencial po
      ON po.empresa = sf.empresa AND po.cod_folha = sf.cod_folha
  ),
  -- ---------- Lado Unificado: do cache ----------
  unificado AS (
    SELECT
      u.empresa,
      u.produto_raiz AS cod_raiz,
      u.saldo_total_em_unidades AS un_unificado,
      u.disponivel_total_em_unidades AS disp_un,
      u.bloqueado_total_em_unidades AS bloq_un,
      u.fator_cx_para_un,
      u.skus_envolvidos
    FROM estoque_unificado_cache u
    WHERE u.empresa = ANY(v_empresas)
  ),
  -- ---------- Mapa cor-folha -> produto_raiz (via estoque_produto_nivel) ----
  raiz_de_folha AS (
    SELECT
      n.cod_produto AS cod_folha,
      COALESCE(n.produto_raiz, n.cod_produto) AS cod_raiz
    FROM estoque_produto_nivel n
  ),
  cores_por_raiz AS (
    SELECT
      cf.empresa,
      COALESCE(rf.cod_raiz, cf.cod_folha) AS cod_raiz,
      SUM(cf.un_disponivel) AS un_cores,
      COUNT(*)::int AS qtd_cores,
      MAX(cf.nome_prod) AS nome_qq,
      MAX(cf.nome_linha) AS nome_linha,
      MAX(cf.abrev_par) AS abrev_par
    FROM cores_por_folha cf
    LEFT JOIN raiz_de_folha rf ON rf.cod_folha = cf.cod_folha
    GROUP BY cf.empresa, COALESCE(rf.cod_raiz, cf.cod_folha)
  ),
  -- ---------- Nome canônico do produto-raiz ----------
  nome_raiz_tab AS (
    SELECT e.cod_produto AS cod_raiz, MAX(e.nome_prod) AS nome_raiz, MAX(e.nome_linha) AS nome_linha
    FROM erp_estoque_distribuidora e
    GROUP BY e.cod_produto
  ),
  -- ---------- Junta os dois lados ----------
  juncao AS (
    SELECT
      COALESCE(c.empresa, u.empresa) AS empresa,
      COALESCE(c.cod_raiz, u.cod_raiz) AS cod_raiz,
      COALESCE(nr.nome_raiz, c.nome_qq) AS nome_raiz,
      COALESCE(nr.nome_linha, c.nome_linha) AS nome_linha,
      c.abrev_par,
      COALESCE(c.qtd_cores, 0) AS qtd_cores,
      COALESCE(u.skus_envolvidos, 0) AS skus_unif,
      COALESCE(c.un_cores, 0) AS un_cores,
      COALESCE(u.un_unificado, 0) AS un_unif,
      COALESCE(u.disp_un, 0) AS disp_un,
      COALESCE(u.bloq_un, 0) AS bloq_un,
      COALESCE(u.fator_cx_para_un, 1) AS fator_cx
    FROM cores_por_raiz c
    FULL OUTER JOIN unificado u
      ON u.empresa = c.empresa AND u.cod_raiz = c.cod_raiz
    LEFT JOIN nome_raiz_tab nr ON nr.cod_raiz = COALESCE(c.cod_raiz, u.cod_raiz)
  ),
  enriched AS (
    SELECT
      j.*,
      (j.un_cores - j.un_unif) AS delta_un,
      CASE WHEN j.un_unif > 0
           THEN ((j.un_cores - j.un_unif) / j.un_unif * 100)
           ELSE NULL END AS delta_pct,
      CASE WHEN j.fator_cx > 0 THEN j.un_cores / j.fator_cx ELSE NULL END AS cx_cores,
      CASE WHEN j.fator_cx > 0 THEN j.un_unif / j.fator_cx ELSE NULL END AS cx_unif,
      CASE
        WHEN j.un_cores = 0 AND j.un_unif > 0 THEN 'ausente_em_cores'
        WHEN j.un_unif = 0 AND j.un_cores > 0 THEN 'ausente_em_unificado'
        WHEN ABS(j.un_cores - j.un_unif) <= GREATEST(p_tolerancia, 0) THEN 'ok'
        ELSE 'divergente'
      END AS st
    FROM juncao j
  ),
  filtrado AS (
    SELECT *
    FROM enriched e
    WHERE
      (p_linhas IS NULL OR e.nome_linha = ANY(p_linhas))
      AND (NOT p_apenas_divergentes OR e.st <> 'ok')
      AND (
        p_busca IS NULL OR p_busca = ''
        OR e.nome_raiz ILIKE '%'||p_busca||'%'
        OR e.cod_raiz::text = p_busca
      )
  ),
  counted AS (
    SELECT f.*, COUNT(*) OVER () AS _total FROM filtrado f
  )
  SELECT
    c.empresa,
    c.abrev_par,
    c.cod_raiz,
    c.nome_raiz,
    c.nome_linha,
    c.qtd_cores,
    c.skus_unif,
    c.un_cores,
    c.un_unif,
    c.delta_un,
    c.delta_pct,
    c.fator_cx,
    c.cx_cores,
    c.cx_unif,
    c.disp_un,
    c.bloq_un,
    c.st,
    c._total
  FROM counted c
  ORDER BY
    CASE WHEN p_order_by = 'nome_raiz' AND p_order_dir = 'asc'  THEN c.nome_raiz END ASC,
    CASE WHEN p_order_by = 'nome_raiz' AND p_order_dir = 'desc' THEN c.nome_raiz END DESC,
    CASE WHEN p_order_by = 'un_cores'  AND p_order_dir = 'desc' THEN c.un_cores END DESC,
    CASE WHEN p_order_by = 'un_unificado' AND p_order_dir = 'desc' THEN c.un_unif END DESC,
    CASE WHEN p_order_by = 'delta_un'  AND p_order_dir = 'desc' THEN c.delta_un END DESC,
    CASE WHEN p_order_by = 'delta_abs' AND p_order_dir = 'desc' THEN ABS(c.delta_un) END DESC,
    CASE WHEN p_order_by = 'empresa'   AND p_order_dir = 'asc'  THEN c.empresa END ASC
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
END
$$;

GRANT EXECUTE ON FUNCTION public.rpc_estoque_cores_vs_unificado(
  integer[], text[], text, boolean, numeric, integer, integer, text, text
) TO authenticated;

-- ============================================================================
-- KPIs agregados
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_estoque_cores_vs_unificado_kpis(
  p_empresas integer[] DEFAULT NULL,
  p_linhas text[] DEFAULT NULL,
  p_tolerancia numeric DEFAULT 0.0001
)
RETURNS TABLE (
  raizes_auditadas integer,
  raizes_ok integer,
  raizes_divergentes integer,
  raizes_so_em_cores integer,
  raizes_so_em_unificado integer,
  delta_abs_total_un numeric,
  delta_abs_total_cx numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  RETURN QUERY
  WITH d AS (
    SELECT *
    FROM public.rpc_estoque_cores_vs_unificado(
      p_empresas, p_linhas, NULL, false, p_tolerancia, 100000, 0, 'delta_abs', 'desc'
    )
  )
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'ok')::int,
    COUNT(*) FILTER (WHERE status = 'divergente')::int,
    COUNT(*) FILTER (WHERE status = 'ausente_em_unificado')::int,
    COUNT(*) FILTER (WHERE status = 'ausente_em_cores')::int,
    COALESCE(SUM(ABS(delta_un)), 0)::numeric,
    COALESCE(SUM(CASE WHEN fator_cx_para_un > 0 THEN ABS(delta_un)/fator_cx_para_un ELSE 0 END), 0)::numeric
  FROM d;
END
$$;

GRANT EXECUTE ON FUNCTION public.rpc_estoque_cores_vs_unificado_kpis(
  integer[], text[], numeric
) TO authenticated;
