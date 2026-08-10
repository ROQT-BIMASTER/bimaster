CREATE OR REPLACE FUNCTION public.fn_get_municipios_kpis(
  p_uf text DEFAULT NULL,
  p_regiao text DEFAULT NULL,
  p_microrregiao_id integer DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_vendedor text DEFAULT NULL
)
RETURNS TABLE (
  total_municipios bigint,
  municipios_atendidos bigint,
  taxa_penetracao numeric,
  receita_total_municipios numeric,
  densidade_media numeric,
  pib_total numeric,
  populacao_total bigint,
  municipios_prospect bigint,
  municipios_lead bigint,
  municipios_virgem bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
  vend_mun AS (
    SELECT DISTINCT c.ibge_municipio_id, TRIM(c.vendedor) AS vendedor
    FROM public.clientes c
    WHERE c.ibge_municipio_id IS NOT NULL
      AND LENGTH(TRIM(COALESCE(c.cnpj, ''))) = 14
      AND NULLIF(TRIM(c.vendedor), '') IS NOT NULL
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

GRANT EXECUTE ON FUNCTION public.fn_get_municipios_kpis(text, text, integer, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_municipios_kpis(text, text, integer, text, text, text) TO service_role;