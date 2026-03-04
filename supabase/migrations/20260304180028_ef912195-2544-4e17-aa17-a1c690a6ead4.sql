CREATE OR REPLACE FUNCTION public.fn_get_municipios_kpis(p_uf text DEFAULT NULL::text, p_regiao text DEFAULT NULL::text, p_microrregiao_id integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text)
 RETURNS TABLE(total_municipios bigint, municipios_atendidos bigint, taxa_penetracao numeric, receita_total_municipios numeric, densidade_media numeric, pib_total numeric, populacao_total bigint, municipios_prospect bigint, municipios_lead bigint, municipios_virgem bigint)
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
      COALESCE(SUM(c.valor_ultima_compra), 0) AS receita_total
    FROM public.clientes c
    WHERE c.ibge_municipio_id IS NOT NULL
      AND LENGTH(TRIM(COALESCE(c.cnpj, ''))) = 14
    GROUP BY c.ibge_municipio_id
  ),
  prosp_by_city AS (
    SELECT
      im4.id AS municipio_id,
      COUNT(DISTINCT p2.id)::bigint AS total_prospects
    FROM public.ibge_municipios im4
    INNER JOIN public.municipios m2 ON LOWER(TRIM(unaccent(m2.nome))) = LOWER(TRIM(unaccent(im4.nome)))
      AND m2.uf = im4.uf_sigla
    INNER JOIN public.prospects p2 ON p2.municipio_id = m2.id
    GROUP BY im4.id
  ),
  leads_agg AS (
    SELECT
      im5.id AS municipio_id,
      COUNT(DISTINCT lm.id)::bigint AS total_leads
    FROM public.ibge_municipios im5
    INNER JOIN public.leads_minerados lm ON LOWER(TRIM(unaccent(lm.cidade))) = LOWER(TRIM(unaccent(im5.nome)))
      AND lm.uf = im5.uf_sigla
    WHERE lm.status != 'descartado'
    GROUP BY im5.id
  ),
  base AS (
    SELECT
      im.id,
      COALESCE(im.populacao_estimada, 0) AS populacao,
      COALESCE(im.pib_mil_reais, 0) AS pib_mil_reais,
      COALESCE(ca.total_clientes, 0) AS total_clientes,
      COALESCE(ca.receita_total, 0) AS receita_total,
      CASE 
        WHEN COALESCE(im.populacao_estimada, 0) > 0 
        THEN (COALESCE(ca.total_clientes, 0)::numeric / im.populacao_estimada * 10000)
        ELSE 0
      END AS densidade,
      CASE 
        WHEN COALESCE(ca.total_clientes, 0) > 0 THEN 'Ativo'
        WHEN COALESCE(pc.total_prospects, 0) > 0 THEN 'Prospect'
        WHEN COALESCE(la.total_leads, 0) > 0 THEN 'Lead'
        ELSE 'Virgem'
      END AS status_calc
    FROM public.ibge_municipios im
    LEFT JOIN cli_agg ca ON ca.ibge_municipio_id = im.id
    LEFT JOIN prosp_by_city pc ON pc.municipio_id = im.id
    LEFT JOIN leads_agg la ON la.municipio_id = im.id
    WHERE 1=1
      AND (p_uf IS NULL OR im.uf_sigla = p_uf)
      AND (p_regiao IS NULL OR im.regiao_nome = p_regiao)
      AND (p_microrregiao_id IS NULL OR im.microrregiao_id = p_microrregiao_id)
      AND (p_search IS NULL OR im.nome ILIKE '%' || p_search || '%')
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
    COUNT(*)::bigint AS total_municipios,
    COUNT(CASE WHEN b.total_clientes > 0 THEN 1 END)::bigint AS municipios_atendidos,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(CASE WHEN b.total_clientes > 0 THEN 1 END)::numeric / COUNT(*) * 100), 1)
      ELSE 0
    END AS taxa_penetracao,
    COALESCE(SUM(b.receita_total), 0) AS receita_total_municipios,
    CASE 
      WHEN COUNT(CASE WHEN b.total_clientes > 0 THEN 1 END) > 0
      THEN ROUND(AVG(CASE WHEN b.total_clientes > 0 THEN b.densidade END), 2)
      ELSE 0
    END AS densidade_media,
    COALESCE(SUM(b.pib_mil_reais), 0) AS pib_total,
    COALESCE(SUM(b.populacao), 0)::bigint AS populacao_total,
    COUNT(CASE WHEN b.status_calc = 'Prospect' THEN 1 END)::bigint AS municipios_prospect,
    COUNT(CASE WHEN b.status_calc = 'Lead' THEN 1 END)::bigint AS municipios_lead,
    COUNT(CASE WHEN b.status_calc = 'Virgem' THEN 1 END)::bigint AS municipios_virgem
  FROM base b;
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_get_municipios_intelligence(p_uf text DEFAULT NULL::text, p_regiao text DEFAULT NULL::text, p_microrregiao_id integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_status text DEFAULT NULL::text, p_sort_column text DEFAULT 'nome'::text, p_sort_direction text DEFAULT 'asc'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(municipio_id integer, municipio_nome text, uf_sigla text, regiao_nome text, microrregiao_id integer, microrregiao_nome text, populacao bigint, pib_mil_reais numeric, pib_per_capita numeric, total_clientes bigint, clientes_com_compra bigint, receita_total numeric, receita_maior numeric, ticket_medio numeric, total_prospects bigint, total_leads bigint, densidade_comercial numeric, intensidade_comercial numeric, status_comercial text, vendedor_nome text, total_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_total bigint;
  v_order_clause text;
BEGIN
  v_order_clause := CASE p_sort_column
    WHEN 'populacao' THEN 'im.populacao_estimada'
    WHEN 'pib' THEN 'im.pib_mil_reais'
    WHEN 'pib_per_capita' THEN 'im.pib_per_capita'
    WHEN 'clientes' THEN 'cli_agg.total_clientes'
    WHEN 'receita' THEN 'cli_agg.receita_total'
    WHEN 'ticket_medio' THEN 'cli_agg.ticket_medio'
    WHEN 'densidade' THEN 'densidade_calc'
    WHEN 'status' THEN 'status_calc'
    ELSE 'im.nome'
  END;

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
  prosp_agg AS (
    SELECT
      im2.id AS municipio_id,
      COUNT(p.id)::bigint AS total_prospects
    FROM public.ibge_municipios im2
    INNER JOIN public.prospects p ON LOWER(TRIM(unaccent(p.nome_empresa))) IS NOT NULL
      AND p.municipio_id IS NOT NULL
    GROUP BY im2.id
  ),
  prosp_simple AS (
    SELECT
      m.id AS mun_id,
      COUNT(p.id)::bigint AS total_prospects
    FROM public.municipios m
    INNER JOIN public.prospects p ON p.municipio_id = m.id
    INNER JOIN public.ibge_municipios im3 ON LOWER(TRIM(unaccent(im3.nome))) = LOWER(TRIM(unaccent(m.nome)))
      AND im3.uf_sigla = m.uf
    GROUP BY m.id
  ),
  prosp_by_city AS (
    SELECT
      im4.id AS municipio_id,
      COUNT(DISTINCT p2.id)::bigint AS total_prospects
    FROM public.ibge_municipios im4
    INNER JOIN public.municipios m2 ON LOWER(TRIM(unaccent(m2.nome))) = LOWER(TRIM(unaccent(im4.nome)))
      AND m2.uf = im4.uf_sigla
    INNER JOIN public.prospects p2 ON p2.municipio_id = m2.id
    GROUP BY im4.id
  ),
  leads_agg AS (
    SELECT
      im5.id AS municipio_id,
      COUNT(DISTINCT lm.id)::bigint AS total_leads
    FROM public.ibge_municipios im5
    INNER JOIN public.leads_minerados lm ON LOWER(TRIM(unaccent(lm.cidade))) = LOWER(TRIM(unaccent(im5.nome)))
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
      CASE 
        WHEN COALESCE(im.populacao_estimada, 0) > 0 
        THEN ROUND((COALESCE(ca.total_clientes, 0)::numeric / im.populacao_estimada * 10000), 2)
        ELSE 0
      END AS densidade_calc,
      CASE 
        WHEN COALESCE(im.populacao_estimada, 0) > 0 
        THEN ROUND((COALESCE(ca.receita_total, 0) / im.populacao_estimada), 2)
        ELSE 0
      END AS intensidade_calc,
      CASE 
        WHEN COALESCE(ca.clientes_com_compra, 0) > 0 THEN 'Ativo'
        WHEN COALESCE(ca.total_clientes, 0) > 0 THEN 'Ativo'
        WHEN COALESCE(pc.total_prospects, 0) > 0 THEN 'Prospect'
        WHEN COALESCE(la.total_leads, 0) > 0 THEN 'Lead'
        ELSE 'Virgem'
      END AS status_calc,
      va.vendedor_nome
    FROM public.ibge_municipios im
    LEFT JOIN cli_agg ca ON ca.ibge_municipio_id = im.id
    LEFT JOIN prosp_by_city pc ON pc.municipio_id = im.id
    LEFT JOIN leads_agg la ON la.municipio_id = im.id
    LEFT JOIN vendedor_agg va ON va.microrregiao_id = im.microrregiao_id
    WHERE 1=1
      AND (p_uf IS NULL OR im.uf_sigla = p_uf)
      AND (p_regiao IS NULL OR im.regiao_nome = p_regiao)
      AND (p_microrregiao_id IS NULL OR im.microrregiao_id = p_microrregiao_id)
      AND (p_search IS NULL OR im.nome ILIKE '%' || p_search || '%')
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
    b.municipio_id,
    b.municipio_nome,
    b.uf_sigla,
    b.regiao_nome,
    b.microrregiao_id,
    b.microrregiao_nome,
    b.populacao,
    b.pib_mil_reais,
    b.pib_per_capita,
    b.total_clientes,
    b.clientes_com_compra,
    b.receita_total,
    b.receita_maior,
    b.ticket_medio,
    b.total_prospects,
    b.total_leads,
    b.densidade_calc AS densidade_comercial,
    b.intensidade_calc AS intensidade_comercial,
    b.status_calc AS status_comercial,
    b.vendedor_nome,
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