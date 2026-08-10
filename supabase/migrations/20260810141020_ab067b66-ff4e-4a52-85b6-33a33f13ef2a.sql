DROP FUNCTION IF EXISTS public.fn_get_municipios_intelligence(text,text,integer,text,text,text,text,integer,integer);

CREATE OR REPLACE FUNCTION public.fn_get_municipios_intelligence(
  p_uf text DEFAULT NULL,
  p_regiao text DEFAULT NULL,
  p_microrregiao_id integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_sort_column text DEFAULT 'nome',
  p_sort_direction text DEFAULT 'asc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_vendedor text DEFAULT NULL
)
RETURNS TABLE(
  municipio_id integer, municipio_nome text, uf_sigla text, regiao_nome text,
  microrregiao_id integer, microrregiao_nome text, populacao bigint,
  pib_mil_reais numeric, pib_per_capita numeric, total_clientes bigint,
  clientes_com_compra bigint, receita_total numeric, receita_maior numeric,
  ticket_medio numeric, total_prospects bigint, total_leads bigint,
  densidade_comercial numeric, intensidade_comercial numeric, status_comercial text,
  vendedor_nome text, vendedores jsonb, total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  WITH cli_agg AS (
    SELECT
      c.ibge_municipio_id,
      COUNT(*)::bigint AS total_clientes,
      COUNT(CASE WHEN c.data_ultima_compra IS NOT NULL THEN 1 END)::bigint AS clientes_com_compra,
      COALESCE(SUM(c.valor_ultima_compra), 0) AS receita_total,
      COALESCE(MAX(c.valor_maior_compra), 0) AS receita_maior,
      CASE
        WHEN COUNT(CASE WHEN c.data_ultima_compra IS NOT NULL THEN 1 END) > 0
        THEN COALESCE(SUM(c.valor_ultima_compra), 0) / COUNT(CASE WHEN c.data_ultima_compra IS NOT NULL THEN 1 END)
        ELSE 0
      END AS ticket_medio
    FROM public.clientes c
    WHERE c.ibge_municipio_id IS NOT NULL
      AND LENGTH(TRIM(COALESCE(c.cnpj, ''))) = 14
    GROUP BY c.ibge_municipio_id
  ),
  vend_mun AS (
    SELECT
      c.ibge_municipio_id,
      TRIM(c.vendedor) AS vendedor,
      COUNT(*)::bigint AS clientes,
      MAX(c.data_ultima_compra) AS ultima_compra,
      COALESCE(SUM(c.valor_ultima_compra), 0) AS receita
    FROM public.clientes c
    WHERE c.ibge_municipio_id IS NOT NULL
      AND LENGTH(TRIM(COALESCE(c.cnpj, ''))) = 14
      AND NULLIF(TRIM(c.vendedor), '') IS NOT NULL
    GROUP BY c.ibge_municipio_id, TRIM(c.vendedor)
  ),
  vend_rank AS (
    SELECT
      vm.*,
      COUNT(*) OVER (PARTITION BY vm.ibge_municipio_id) AS total_vendedores,
      ROW_NUMBER() OVER (
        PARTITION BY vm.ibge_municipio_id
        ORDER BY vm.ultima_compra DESC NULLS LAST, vm.clientes DESC, vm.vendedor
      ) AS rn_recente,
      ROW_NUMBER() OVER (
        PARTITION BY vm.ibge_municipio_id
        ORDER BY vm.clientes DESC, vm.vendedor
      ) AS rn_principal
    FROM vend_mun vm
  ),
  vend_json AS (
    SELECT
      vr.ibge_municipio_id,
      MAX(vr.total_vendedores)::int AS total_vendedores,
      MAX(CASE WHEN vr.rn_principal = 1 THEN vr.vendedor END) AS vendedor_principal,
      jsonb_agg(
        jsonb_build_object(
          'nome', vr.vendedor,
          'clientes', vr.clientes,
          'ultima_compra', vr.ultima_compra,
          'receita', vr.receita,
          'mais_recente', (vr.rn_recente = 1 AND vr.ultima_compra IS NOT NULL)
        )
        ORDER BY vr.ultima_compra DESC NULLS LAST, vr.clientes DESC
      ) AS vendedores
    FROM vend_rank vr
    GROUP BY vr.ibge_municipio_id
  ),
  prosp_by_city AS (
    SELECT
      im4.id AS municipio_id,
      COUNT(DISTINCT p2.id)::bigint AS total_prospects
    FROM public.ibge_municipios im4
    INNER JOIN public.municipios m2 ON LOWER(TRIM(public.unaccent(m2.nome))) = LOWER(TRIM(public.unaccent(im4.nome)))
      AND m2.uf = im4.uf_sigla
    INNER JOIN public.prospects p2 ON p2.municipio_id = m2.id
    GROUP BY im4.id
  ),
  leads_agg AS (
    SELECT
      im5.id AS municipio_id,
      COUNT(DISTINCT lm.id)::bigint AS total_leads
    FROM public.ibge_municipios im5
    INNER JOIN public.leads_minerados lm ON LOWER(TRIM(public.unaccent(lm.cidade))) = LOWER(TRIM(public.unaccent(im5.nome)))
      AND lm.uf = im5.uf_sigla
    WHERE lm.status != 'descartado'
    GROUP BY im5.id
  ),
  vendedor_agg AS (
    SELECT DISTINCT ON (vt.microrregiao_id)
      vt.microrregiao_id,
      pr.nome AS vendedor_nome
    FROM public.vendedor_territorios vt
    INNER JOIN public.profiles pr ON pr.id = vt.vendedor_id
    WHERE vt.ativo = true AND vt.microrregiao_id IS NOT NULL
    ORDER BY vt.microrregiao_id, vt.created_at DESC
  ),
  base AS (
    SELECT
      im.id AS municipio_id,
      im.nome AS municipio_nome,
      im.uf_sigla,
      im.regiao_nome,
      im.microrregiao_id,
      im.microrregiao_nome,
      COALESCE(im.populacao_estimada, 0) AS populacao,
      COALESCE(im.pib_mil_reais, 0) AS pib_mil_reais,
      COALESCE(im.pib_per_capita, 0) AS pib_per_capita,
      COALESCE(ca.total_clientes, 0) AS total_clientes,
      COALESCE(ca.clientes_com_compra, 0) AS clientes_com_compra,
      COALESCE(ca.receita_total, 0) AS receita_total,
      COALESCE(ca.receita_maior, 0) AS receita_maior,
      COALESCE(ca.ticket_medio, 0) AS ticket_medio,
      COALESCE(pc.total_prospects, 0) AS total_prospects,
      COALESCE(la.total_leads, 0) AS total_leads,
      CASE WHEN COALESCE(im.populacao_estimada, 0) > 0
        THEN ROUND((COALESCE(ca.total_clientes, 0)::numeric / im.populacao_estimada * 10000), 2)
        ELSE 0 END AS densidade_calc,
      CASE WHEN COALESCE(im.populacao_estimada, 0) > 0
        THEN ROUND((COALESCE(ca.receita_total, 0) / im.populacao_estimada), 2)
        ELSE 0 END AS intensidade_calc,
      CASE
        WHEN COALESCE(ca.clientes_com_compra, 0) > 0 THEN 'Ativo'
        WHEN COALESCE(ca.total_clientes, 0) > 0 THEN 'Ativo'
        WHEN COALESCE(pc.total_prospects, 0) > 0 THEN 'Prospect'
        WHEN COALESCE(la.total_leads, 0) > 0 THEN 'Lead'
        ELSE 'Virgem'
      END AS status_calc,
      COALESCE(
        vj.vendedor_principal
          || CASE WHEN COALESCE(vj.total_vendedores, 1) > 1
                  THEN ' (+' || (vj.total_vendedores - 1) || ')' ELSE '' END,
        va.vendedor_nome
      ) AS vendedor_nome,
      COALESCE(vj.vendedores, '[]'::jsonb) AS vendedores
    FROM public.ibge_municipios im
    LEFT JOIN cli_agg ca ON ca.ibge_municipio_id = im.id
    LEFT JOIN vend_json vj ON vj.ibge_municipio_id = im.id
    LEFT JOIN prosp_by_city pc ON pc.municipio_id = im.id
    LEFT JOIN leads_agg la ON la.municipio_id = im.id
    LEFT JOIN vendedor_agg va ON va.microrregiao_id = im.microrregiao_id
    WHERE 1=1
      AND (p_uf IS NULL OR im.uf_sigla = p_uf)
      AND (p_regiao IS NULL OR im.regiao_nome = p_regiao)
      AND (p_microrregiao_id IS NULL OR im.microrregiao_id = p_microrregiao_id)
      AND (p_search IS NULL OR im.nome ILIKE '%' || p_search || '%')
      AND (
        p_vendedor IS NULL
        OR EXISTS (
          SELECT 1 FROM vend_mun vmf
          WHERE vmf.ibge_municipio_id = im.id
            AND vmf.vendedor = p_vendedor
        )
      )
      AND (
        p_status IS NULL
        OR p_status = 'todos'
        OR (p_status = 'com_clientes' AND COALESCE(ca.total_clientes, 0) > 0)
        OR (p_status = 'sem_clientes' AND COALESCE(ca.total_clientes, 0) = 0)
        OR (p_status = 'com_prospects' AND COALESCE(pc.total_prospects, 0) > 0)
        OR (p_status = 'virgem' AND COALESCE(ca.total_clientes, 0) = 0 AND COALESCE(pc.total_prospects, 0) = 0 AND COALESCE(la.total_leads, 0) = 0)
      )
  )
  SELECT
    b.municipio_id, b.municipio_nome, b.uf_sigla, b.regiao_nome,
    b.microrregiao_id, b.microrregiao_nome, b.populacao,
    b.pib_mil_reais, b.pib_per_capita, b.total_clientes,
    b.clientes_com_compra, b.receita_total, b.receita_maior,
    b.ticket_medio, b.total_prospects, b.total_leads,
    b.densidade_calc, b.intensidade_calc, b.status_calc,
    b.vendedor_nome, b.vendedores,
    COUNT(*) OVER() AS total_count
  FROM base b
  ORDER BY
    CASE WHEN p_sort_direction = 'asc' THEN
      CASE p_sort_column
        WHEN 'populacao' THEN b.populacao::text
        WHEN 'pib' THEN LPAD(b.pib_mil_reais::text, 20, '0')
        WHEN 'pib_per_capita' THEN LPAD(b.pib_per_capita::text, 20, '0')
        WHEN 'clientes' THEN LPAD(b.total_clientes::text, 10, '0')
        WHEN 'receita' THEN LPAD(b.receita_total::text, 20, '0')
        WHEN 'densidade' THEN LPAD(b.densidade_calc::text, 20, '0')
        WHEN 'status' THEN b.status_calc
        ELSE b.municipio_nome
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_direction = 'desc' THEN
      CASE p_sort_column
        WHEN 'populacao' THEN b.populacao::text
        WHEN 'pib' THEN LPAD(b.pib_mil_reais::text, 20, '0')
        WHEN 'pib_per_capita' THEN LPAD(b.pib_per_capita::text, 20, '0')
        WHEN 'clientes' THEN LPAD(b.total_clientes::text, 10, '0')
        WHEN 'receita' THEN LPAD(b.receita_total::text, 20, '0')
        WHEN 'densidade' THEN LPAD(b.densidade_calc::text, 20, '0')
        WHEN 'status' THEN b.status_calc
        ELSE b.municipio_nome
      END
    END DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_get_municipios_vendedores(
  p_uf text DEFAULT NULL,
  p_regiao text DEFAULT NULL
)
RETURNS TABLE(vendedor text, municipios bigint, clientes bigint, ultima_compra date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    TRIM(c.vendedor) AS vendedor,
    COUNT(DISTINCT c.ibge_municipio_id)::bigint AS municipios,
    COUNT(*)::bigint AS clientes,
    MAX(c.data_ultima_compra)::date AS ultima_compra
  FROM public.clientes c
  JOIN public.ibge_municipios im ON im.id = c.ibge_municipio_id
  WHERE c.ibge_municipio_id IS NOT NULL
    AND LENGTH(TRIM(COALESCE(c.cnpj, ''))) = 14
    AND NULLIF(TRIM(c.vendedor), '') IS NOT NULL
    AND (p_uf IS NULL OR im.uf_sigla = p_uf)
    AND (p_regiao IS NULL OR im.regiao_nome = p_regiao)
  GROUP BY TRIM(c.vendedor)
  ORDER BY 1;
$function$;

REVOKE ALL ON FUNCTION public.fn_get_municipios_intelligence(text,text,integer,text,text,text,text,integer,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_municipios_intelligence(text,text,integer,text,text,text,text,integer,integer,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_get_municipios_vendedores(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_get_municipios_vendedores(text,text) TO authenticated, service_role;