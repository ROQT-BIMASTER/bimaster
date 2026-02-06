
-- Fix fn_calcular_cobertura_mercado to use unaccent fuzzy matching for all sources
CREATE OR REPLACE FUNCTION fn_calcular_cobertura_mercado()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.market_coverage_snapshot;

  INSERT INTO public.market_coverage_snapshot (
    uf, regiao_nome, total_municipios,
    municipios_com_clientes, municipios_com_prospects, municipios_com_leads,
    total_clientes_erp, total_prospects, total_leads_minerados,
    penetracao_percentual, cobertura_percentual, pipeline_percentual,
    populacao_total, pib_total_mil_reais,
    vendedores_atribuidos, updated_at
  )
  SELECT
    ibge.uf_sigla AS uf,
    ibge.regiao_nome,
    ibge.total_municipios,
    COALESCE(cli.municipios_com_clientes, 0),
    COALESCE(prosp.municipios_com_prospects, 0),
    COALESCE(leads.municipios_com_leads, 0),
    COALESCE(cli.total_clientes, 0),
    COALESCE(prosp.total_prospects, 0),
    COALESCE(leads.total_leads, 0),
    CASE WHEN ibge.total_municipios > 0
      THEN ROUND((COALESCE(cli.municipios_com_clientes, 0)::NUMERIC / ibge.total_municipios) * 100, 2)
      ELSE 0
    END,
    CASE WHEN COALESCE(leads.total_leads, 0) > 0
      THEN LEAST(ROUND(((COALESCE(cli.total_clientes, 0) + COALESCE(prosp.total_prospects, 0))::NUMERIC / leads.total_leads) * 100, 2), 99999)
      ELSE 0
    END,
    CASE WHEN COALESCE(leads.total_leads, 0) > 0
      THEN LEAST(ROUND((COALESCE(prosp.total_prospects, 0)::NUMERIC / leads.total_leads) * 100, 2), 99999)
      ELSE 0
    END,
    COALESCE(ibge.populacao_total, 0),
    COALESCE(ibge.pib_total, 0),
    COALESCE(terr.vendedores, ARRAY[]::TEXT[]),
    now()
  FROM (
    -- IBGE base: total municipalities per UF
    SELECT e.sigla AS uf_sigla, MIN(m.regiao_nome) AS regiao_nome,
      COUNT(*) AS total_municipios,
      SUM(COALESCE(m.populacao_estimada, 0)) AS populacao_total,
      SUM(COALESCE(m.pib_mil_reais, 0)) AS pib_total
    FROM public.ibge_municipios m
    JOIN public.ibge_estados e ON m.uf_id = e.id
    GROUP BY e.sigla
  ) ibge

  -- CLIENTES: use ibge_municipio_id when available, fallback to unaccent match
  LEFT JOIN (
    SELECT 
      UPPER(TRIM(c.uf)) AS uf,
      COUNT(DISTINCT matched_id) AS municipios_com_clientes,
      COUNT(*) AS total_clientes
    FROM (
      SELECT 
        c.uf,
        COALESCE(
          c.ibge_municipio_id,
          (SELECT m.id FROM ibge_municipios m 
           JOIN ibge_estados e ON m.uf_id = e.id
           WHERE e.sigla = UPPER(TRIM(c.uf))
             AND UPPER(public.unaccent(TRIM(m.nome))) = UPPER(public.unaccent(TRIM(c.cidade)))
           LIMIT 1),
          -- Fallback: try matching without apostrophes/special chars
          (SELECT m.id FROM ibge_municipios m 
           JOIN ibge_estados e ON m.uf_id = e.id
           WHERE e.sigla = UPPER(TRIM(c.uf))
             AND UPPER(regexp_replace(public.unaccent(TRIM(m.nome)), '[''`´\-]', '', 'g')) 
               = UPPER(regexp_replace(public.unaccent(TRIM(c.cidade)), '[''`´\-]', '', 'g'))
           LIMIT 1)
        ) AS matched_id
      FROM public.clientes c
      WHERE c.uf IS NOT NULL AND TRIM(c.uf) <> '' AND LENGTH(TRIM(c.uf)) = 2
        AND c.cnpj IS NOT NULL AND LENGTH(TRIM(c.cnpj)) = 14
        AND c.cidade IS NOT NULL AND TRIM(c.cidade) <> ''
    ) c
    WHERE matched_id IS NOT NULL
    GROUP BY UPPER(TRIM(c.uf))
  ) cli ON cli.uf = ibge.uf_sigla

  -- PROSPECTS: fuzzy match against IBGE using unaccent
  LEFT JOIN (
    SELECT 
      UPPER(TRIM(p.uf)) AS uf,
      COUNT(DISTINCT matched_id) AS municipios_com_prospects,
      COUNT(*) AS total_prospects
    FROM (
      SELECT 
        p.uf,
        COALESCE(
          (SELECT m.id FROM ibge_municipios m 
           JOIN ibge_estados e ON m.uf_id = e.id
           WHERE e.sigla = UPPER(TRIM(p.uf))
             AND UPPER(public.unaccent(TRIM(m.nome))) = UPPER(public.unaccent(TRIM(p.municipio)))
           LIMIT 1),
          (SELECT m.id FROM ibge_municipios m 
           JOIN ibge_estados e ON m.uf_id = e.id
           WHERE e.sigla = UPPER(TRIM(p.uf))
             AND UPPER(regexp_replace(public.unaccent(TRIM(m.nome)), '[''`´\-]', '', 'g')) 
               = UPPER(regexp_replace(public.unaccent(TRIM(p.municipio)), '[''`´\-]', '', 'g'))
           LIMIT 1)
        ) AS matched_id
      FROM public.prospects p 
      WHERE p.uf IS NOT NULL AND TRIM(p.uf) <> ''
        AND p.municipio IS NOT NULL AND TRIM(p.municipio) <> ''
    ) p
    WHERE matched_id IS NOT NULL
    GROUP BY UPPER(TRIM(p.uf))
  ) prosp ON prosp.uf = ibge.uf_sigla

  -- LEADS: fuzzy match against IBGE using unaccent
  LEFT JOIN (
    SELECT 
      UPPER(TRIM(l.uf)) AS uf,
      COUNT(DISTINCT matched_id) AS municipios_com_leads,
      COUNT(*) AS total_leads
    FROM (
      SELECT 
        l.uf,
        COALESCE(
          (SELECT m.id FROM ibge_municipios m 
           JOIN ibge_estados e ON m.uf_id = e.id
           WHERE e.sigla = UPPER(TRIM(l.uf))
             AND UPPER(public.unaccent(TRIM(m.nome))) = UPPER(public.unaccent(TRIM(l.cidade)))
           LIMIT 1),
          (SELECT m.id FROM ibge_municipios m 
           JOIN ibge_estados e ON m.uf_id = e.id
           WHERE e.sigla = UPPER(TRIM(l.uf))
             AND UPPER(regexp_replace(public.unaccent(TRIM(m.nome)), '[''`´\-]', '', 'g')) 
               = UPPER(regexp_replace(public.unaccent(TRIM(l.cidade)), '[''`´\-]', '', 'g'))
           LIMIT 1)
        ) AS matched_id
      FROM public.leads_minerados l 
      WHERE l.uf IS NOT NULL AND TRIM(l.uf) <> ''
        AND l.cidade IS NOT NULL AND TRIM(l.cidade) <> ''
    ) l
    WHERE matched_id IS NOT NULL
    GROUP BY UPPER(TRIM(l.uf))
  ) leads ON leads.uf = ibge.uf_sigla

  -- TERRITÓRIOS
  LEFT JOIN (
    SELECT UPPER(TRIM(vt.uf)) AS uf,
      ARRAY_AGG(DISTINCT p.nome) AS vendedores
    FROM public.vendedor_territorios vt
    JOIN public.profiles p ON p.id = vt.vendedor_id
    WHERE vt.ativo = true GROUP BY UPPER(TRIM(vt.uf))
  ) terr ON terr.uf = ibge.uf_sigla;

  -- Also update the normalization for clients that still have NULL ibge_municipio_id
  -- using the same fuzzy logic (apostrophe-stripped match)
  UPDATE public.clientes c
  SET ibge_municipio_id = sub.matched_id,
      cidade_normalizada = sub.matched_nome
  FROM (
    SELECT c2.id,
      m.id AS matched_id,
      m.nome AS matched_nome
    FROM public.clientes c2
    JOIN public.ibge_estados e ON e.sigla = UPPER(TRIM(c2.uf))
    JOIN public.ibge_municipios m ON m.uf_id = e.id
      AND UPPER(regexp_replace(public.unaccent(TRIM(m.nome)), '[''`´\- ]', '', 'g'))
        = UPPER(regexp_replace(public.unaccent(TRIM(c2.cidade)), '[''`´\- ]', '', 'g'))
    WHERE c2.ibge_municipio_id IS NULL
      AND c2.cnpj IS NOT NULL AND LENGTH(TRIM(c2.cnpj)) = 14
      AND c2.cidade IS NOT NULL AND TRIM(c2.cidade) <> ''
      AND c2.uf IS NOT NULL AND LENGTH(TRIM(c2.uf)) = 2
  ) sub
  WHERE c.id = sub.id;
END;
$$;
