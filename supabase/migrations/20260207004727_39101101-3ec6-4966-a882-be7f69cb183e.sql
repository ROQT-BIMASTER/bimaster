
-- Drop and recreate fn_get_whitespace_analysis (return type changed)
DROP FUNCTION IF EXISTS public.fn_get_whitespace_analysis(text,text,numeric,text,text,integer,integer);

-- Drop and recreate fn_get_whitespace_top_microrregioes (fix window function bug)
DROP FUNCTION IF EXISTS public.fn_get_whitespace_top_microrregioes(text,text,numeric,integer);

-- Recreate fn_get_whitespace_analysis with correct types
CREATE OR REPLACE FUNCTION public.fn_get_whitespace_analysis(
  p_uf text DEFAULT NULL,
  p_regiao text DEFAULT NULL,
  p_min_penetracao numeric DEFAULT 0,
  p_sort_column text DEFAULT 'score_expansao',
  p_sort_direction text DEFAULT 'desc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  municipio_id integer,
  municipio_nome text,
  uf text,
  regiao text,
  populacao bigint,
  pib_mil_reais numeric,
  pib_per_capita numeric,
  microrregiao_id integer,
  microrregiao_nome text,
  total_municipios_micro bigint,
  municipios_ativos_micro bigint,
  penetracao_micro numeric,
  clientes_vizinhos numeric,
  receita_micro numeric,
  vendedor_nome text,
  score_expansao numeric,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ufs text[];
BEGIN
  IF p_regiao IS NOT NULL THEN
    SELECT CASE p_regiao
      WHEN 'Norte' THEN ARRAY['AC','AM','AP','PA','RO','RR','TO']
      WHEN 'Nordeste' THEN ARRAY['AL','BA','CE','MA','PB','PE','PI','RN','SE']
      WHEN 'Centro-Oeste' THEN ARRAY['DF','GO','MS','MT']
      WHEN 'Sudeste' THEN ARRAY['ES','MG','RJ','SP']
      WHEN 'Sul' THEN ARRAY['PR','RS','SC']
      ELSE NULL
    END INTO v_ufs;
  END IF;

  RETURN QUERY
  WITH 
  municipios_ativos AS (
    SELECT DISTINCT c.ibge_municipio_id
    FROM clientes c
    WHERE c.ibge_municipio_id IS NOT NULL
  ),
  micro_stats AS (
    SELECT 
      m.microrregiao_id AS mid,
      m.microrregiao_nome AS mname,
      COUNT(*) AS total_mun,
      COUNT(ma.ibge_municipio_id) AS ativos_mun,
      ROUND(COUNT(ma.ibge_municipio_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS penetracao,
      COALESCE(SUM(CASE WHEN ma.ibge_municipio_id IS NOT NULL THEN c_agg.receita ELSE 0 END), 0) AS receita_total,
      COALESCE(SUM(CASE WHEN ma.ibge_municipio_id IS NOT NULL THEN c_agg.num_clientes ELSE 0 END), 0) AS total_clientes_ativos
    FROM ibge_municipios m
    LEFT JOIN municipios_ativos ma ON ma.ibge_municipio_id = m.id
    LEFT JOIN LATERAL (
      SELECT 
        SUM(COALESCE(cl.valor_ultima_compra, 0)) AS receita,
        COUNT(*)::numeric AS num_clientes
      FROM clientes cl
      WHERE cl.ibge_municipio_id = m.id
    ) c_agg ON TRUE
    GROUP BY m.microrregiao_id, m.microrregiao_nome
    HAVING COUNT(ma.ibge_municipio_id) > 0
       AND COUNT(ma.ibge_municipio_id) < COUNT(*)
  ),
  vendedor_micro AS (
    SELECT DISTINCT ON (vt.microrregiao_id)
      vt.microrregiao_id AS mid,
      p.nome AS vendedor_nome
    FROM vendedor_territorios vt
    JOIN profiles p ON p.id = vt.vendedor_id
    WHERE vt.ativo = true AND vt.microrregiao_id IS NOT NULL
    ORDER BY vt.microrregiao_id, vt.created_at DESC
  ),
  whitespace AS (
    SELECT 
      m.id AS mun_id,
      m.nome AS mun_nome,
      m.uf_sigla,
      m.regiao_nome,
      m.populacao_estimada,
      m.pib_mil_reais,
      m.pib_per_capita,
      ms.mid AS micro_id,
      ms.mname AS micro_nome,
      ms.total_mun,
      ms.ativos_mun,
      ms.penetracao,
      ms.total_clientes_ativos AS clientes_viz,
      ms.receita_total AS rec_micro,
      vm.vendedor_nome AS vend_nome,
      ROUND(COALESCE(m.pib_per_capita, 0) * (ms.ativos_mun::numeric / NULLIF(ms.total_mun, 0)), 2) AS score
    FROM ibge_municipios m
    JOIN micro_stats ms ON ms.mid = m.microrregiao_id
    LEFT JOIN municipios_ativos ma ON ma.ibge_municipio_id = m.id
    LEFT JOIN vendedor_micro vm ON vm.mid = m.microrregiao_id
    WHERE ma.ibge_municipio_id IS NULL
      AND (p_uf IS NULL OR m.uf_sigla = p_uf)
      AND (v_ufs IS NULL OR m.uf_sigla = ANY(v_ufs))
      AND ms.penetracao >= p_min_penetracao
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM whitespace
  )
  SELECT 
    w.mun_id,
    w.mun_nome,
    w.uf_sigla,
    w.regiao_nome,
    w.populacao_estimada,
    w.pib_mil_reais,
    w.pib_per_capita,
    w.micro_id,
    w.micro_nome,
    w.total_mun,
    w.ativos_mun,
    w.penetracao,
    w.clientes_viz,
    w.rec_micro,
    w.vend_nome,
    w.score,
    c.cnt
  FROM whitespace w
  CROSS JOIN counted c
  ORDER BY
    CASE WHEN p_sort_direction = 'asc' THEN
      CASE p_sort_column
        WHEN 'score_expansao' THEN w.score
        WHEN 'pib_per_capita' THEN w.pib_per_capita
        WHEN 'populacao' THEN w.populacao_estimada
        WHEN 'penetracao' THEN w.penetracao
        ELSE w.score
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_direction = 'desc' OR p_sort_direction IS NULL THEN
      CASE p_sort_column
        WHEN 'score_expansao' THEN w.score
        WHEN 'pib_per_capita' THEN w.pib_per_capita
        WHEN 'populacao' THEN w.populacao_estimada
        WHEN 'penetracao' THEN w.penetracao
        ELSE w.score
      END
    END DESC NULLS LAST,
    w.mun_nome ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Recreate fn_get_whitespace_top_microrregioes without window functions in aggregates
CREATE OR REPLACE FUNCTION public.fn_get_whitespace_top_microrregioes(
  p_uf text DEFAULT NULL,
  p_regiao text DEFAULT NULL,
  p_min_penetracao numeric DEFAULT 0,
  p_limit integer DEFAULT 15
)
RETURNS TABLE (
  microrregiao_id integer,
  microrregiao_nome text,
  uf text,
  total_municipios bigint,
  municipios_ativos bigint,
  municipios_whitespace bigint,
  penetracao numeric,
  pib_inexplorado numeric,
  receita_atual numeric,
  score_agregado numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ufs text[];
BEGIN
  IF p_regiao IS NOT NULL THEN
    SELECT CASE p_regiao
      WHEN 'Norte' THEN ARRAY['AC','AM','AP','PA','RO','RR','TO']
      WHEN 'Nordeste' THEN ARRAY['AL','BA','CE','MA','PB','PE','PI','RN','SE']
      WHEN 'Centro-Oeste' THEN ARRAY['DF','GO','MS','MT']
      WHEN 'Sudeste' THEN ARRAY['ES','MG','RJ','SP']
      WHEN 'Sul' THEN ARRAY['PR','RS','SC']
      ELSE NULL
    END INTO v_ufs;
  END IF;

  RETURN QUERY
  WITH 
  municipios_ativos AS (
    SELECT DISTINCT c.ibge_municipio_id
    FROM clientes c
    WHERE c.ibge_municipio_id IS NOT NULL
  ),
  micro_data AS (
    SELECT 
      m.microrregiao_id AS mid,
      m.microrregiao_nome AS mname,
      m.uf_sigla,
      COUNT(*) AS total_mun,
      COUNT(ma.ibge_municipio_id) AS ativos_mun,
      COUNT(*) - COUNT(ma.ibge_municipio_id) AS ws_mun,
      ROUND(COUNT(ma.ibge_municipio_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS pen,
      COALESCE(SUM(CASE WHEN ma.ibge_municipio_id IS NULL THEN m.pib_mil_reais ELSE 0 END), 0) AS pib_ws,
      COALESCE(SUM(CASE WHEN ma.ibge_municipio_id IS NOT NULL THEN c_agg.receita ELSE 0 END), 0) AS rec,
      -- Score = avg PIB per capita of whitespace muns * penetration ratio
      ROUND(
        COALESCE(
          AVG(CASE WHEN ma.ibge_municipio_id IS NULL THEN m.pib_per_capita END), 0
        ) * (
          COUNT(ma.ibge_municipio_id)::numeric / NULLIF(COUNT(*), 0)
        ),
        2
      ) AS avg_score
    FROM ibge_municipios m
    LEFT JOIN municipios_ativos ma ON ma.ibge_municipio_id = m.id
    LEFT JOIN LATERAL (
      SELECT SUM(COALESCE(cl.valor_ultima_compra, 0)) AS receita
      FROM clientes cl
      WHERE cl.ibge_municipio_id = m.id
    ) c_agg ON TRUE
    WHERE (p_uf IS NULL OR m.uf_sigla = p_uf)
      AND (v_ufs IS NULL OR m.uf_sigla = ANY(v_ufs))
    GROUP BY m.microrregiao_id, m.microrregiao_nome, m.uf_sigla
    HAVING COUNT(ma.ibge_municipio_id) > 0
       AND COUNT(ma.ibge_municipio_id) < COUNT(*)
       AND ROUND(COUNT(ma.ibge_municipio_id)::numeric / NULLIF(COUNT(*), 0) * 100, 1) >= p_min_penetracao
  )
  SELECT 
    md.mid,
    md.mname,
    md.uf_sigla,
    md.total_mun,
    md.ativos_mun,
    md.ws_mun,
    md.pen,
    md.pib_ws,
    md.rec,
    COALESCE(md.avg_score, 0)
  FROM micro_data md
  ORDER BY md.avg_score DESC NULLS LAST
  LIMIT p_limit;
END;
$$;
