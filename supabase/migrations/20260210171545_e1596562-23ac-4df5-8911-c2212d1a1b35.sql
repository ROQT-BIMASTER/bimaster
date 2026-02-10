
CREATE OR REPLACE FUNCTION public.fn_get_whitespace_kpi_details(
  p_uf text DEFAULT NULL,
  p_regiao text DEFAULT NULL,
  p_min_penetracao numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'uf_breakdown', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.municipios DESC), '[]'::jsonb)
      FROM (
        SELECT 
          m.uf,
          COUNT(*)::int AS municipios,
          SUM(m.pib_mil_reais)::numeric AS pib,
          SUM(m.populacao)::bigint AS populacao
        FROM ibge_municipios m
        JOIN ibge_microrregioes mi ON mi.id = m.microrregiao_id
        LEFT JOIN clientes c ON c.ibge_municipio_id = m.id AND LENGTH(TRIM(COALESCE(c.cnpj,''))) = 14
        WHERE c.id IS NULL
          AND EXISTS (
            SELECT 1 FROM clientes c2 
            JOIN ibge_municipios m2 ON m2.id = c2.ibge_municipio_id
            WHERE m2.microrregiao_id = m.microrregiao_id
              AND LENGTH(TRIM(COALESCE(c2.cnpj,''))) = 14
          )
          AND (p_uf IS NULL OR m.uf = p_uf)
          AND (p_regiao IS NULL OR mi.uf IN (
            SELECT unnest(CASE p_regiao
              WHEN 'Norte' THEN ARRAY['AC','AM','AP','PA','RO','RR','TO']
              WHEN 'Nordeste' THEN ARRAY['AL','BA','CE','MA','PB','PE','PI','RN','SE']
              WHEN 'Centro-Oeste' THEN ARRAY['DF','GO','MS','MT']
              WHEN 'Sudeste' THEN ARRAY['ES','MG','RJ','SP']
              WHEN 'Sul' THEN ARRAY['PR','RS','SC']
            END)
          ))
        GROUP BY m.uf
        ORDER BY COUNT(*) DESC
        LIMIT 15
      ) t
    ),
    'top_by_pib', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.pib DESC), '[]'::jsonb)
      FROM (
        SELECT 
          m.uf,
          SUM(m.pib_mil_reais)::numeric AS pib,
          COUNT(*)::int AS municipios
        FROM ibge_municipios m
        JOIN ibge_microrregioes mi ON mi.id = m.microrregiao_id
        LEFT JOIN clientes c ON c.ibge_municipio_id = m.id AND LENGTH(TRIM(COALESCE(c.cnpj,''))) = 14
        WHERE c.id IS NULL
          AND EXISTS (
            SELECT 1 FROM clientes c2 
            JOIN ibge_municipios m2 ON m2.id = c2.ibge_municipio_id
            WHERE m2.microrregiao_id = m.microrregiao_id
              AND LENGTH(TRIM(COALESCE(c2.cnpj,''))) = 14
          )
          AND (p_uf IS NULL OR m.uf = p_uf)
          AND (p_regiao IS NULL OR mi.uf IN (
            SELECT unnest(CASE p_regiao
              WHEN 'Norte' THEN ARRAY['AC','AM','AP','PA','RO','RR','TO']
              WHEN 'Nordeste' THEN ARRAY['AL','BA','CE','MA','PB','PE','PI','RN','SE']
              WHEN 'Centro-Oeste' THEN ARRAY['DF','GO','MS','MT']
              WHEN 'Sudeste' THEN ARRAY['ES','MG','RJ','SP']
              WHEN 'Sul' THEN ARRAY['PR','RS','SC']
            END)
          ))
        GROUP BY m.uf
        ORDER BY SUM(m.pib_mil_reais) DESC
        LIMIT 10
      ) t
    ),
    'top_by_pop', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.populacao DESC), '[]'::jsonb)
      FROM (
        SELECT 
          m.uf,
          SUM(m.populacao)::bigint AS populacao,
          COUNT(*)::int AS municipios
        FROM ibge_municipios m
        JOIN ibge_microrregioes mi ON mi.id = m.microrregiao_id
        LEFT JOIN clientes c ON c.ibge_municipio_id = m.id AND LENGTH(TRIM(COALESCE(c.cnpj,''))) = 14
        WHERE c.id IS NULL
          AND EXISTS (
            SELECT 1 FROM clientes c2 
            JOIN ibge_municipios m2 ON m2.id = c2.ibge_municipio_id
            WHERE m2.microrregiao_id = m.microrregiao_id
              AND LENGTH(TRIM(COALESCE(c2.cnpj,''))) = 14
          )
          AND (p_uf IS NULL OR m.uf = p_uf)
          AND (p_regiao IS NULL OR mi.uf IN (
            SELECT unnest(CASE p_regiao
              WHEN 'Norte' THEN ARRAY['AC','AM','AP','PA','RO','RR','TO']
              WHEN 'Nordeste' THEN ARRAY['AL','BA','CE','MA','PB','PE','PI','RN','SE']
              WHEN 'Centro-Oeste' THEN ARRAY['DF','GO','MS','MT']
              WHEN 'Sudeste' THEN ARRAY['ES','MG','RJ','SP']
              WHEN 'Sul' THEN ARRAY['PR','RS','SC']
            END)
          ))
        GROUP BY m.uf
        ORDER BY SUM(m.populacao) DESC
        LIMIT 10
      ) t
    ),
    'top_micros', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.score DESC), '[]'::jsonb)
      FROM (
        SELECT 
          mi.nome,
          mi.uf,
          COUNT(*)::int AS municipios_whitespace,
          ROUND(AVG(CASE WHEN m.populacao > 0 THEN m.pib_mil_reais * 1000.0 / m.populacao ELSE 0 END)::numeric, 1)::numeric AS score
        FROM ibge_municipios m
        JOIN ibge_microrregioes mi ON mi.id = m.microrregiao_id
        LEFT JOIN clientes c ON c.ibge_municipio_id = m.id AND LENGTH(TRIM(COALESCE(c.cnpj,''))) = 14
        WHERE c.id IS NULL
          AND EXISTS (
            SELECT 1 FROM clientes c2 
            JOIN ibge_municipios m2 ON m2.id = c2.ibge_municipio_id
            WHERE m2.microrregiao_id = m.microrregiao_id
              AND LENGTH(TRIM(COALESCE(c2.cnpj,''))) = 14
          )
          AND (p_uf IS NULL OR m.uf = p_uf)
          AND (p_regiao IS NULL OR mi.uf IN (
            SELECT unnest(CASE p_regiao
              WHEN 'Norte' THEN ARRAY['AC','AM','AP','PA','RO','RR','TO']
              WHEN 'Nordeste' THEN ARRAY['AL','BA','CE','MA','PB','PE','PI','RN','SE']
              WHEN 'Centro-Oeste' THEN ARRAY['DF','GO','MS','MT']
              WHEN 'Sudeste' THEN ARRAY['ES','MG','RJ','SP']
              WHEN 'Sul' THEN ARRAY['PR','RS','SC']
            END)
          ))
        GROUP BY mi.id, mi.nome, mi.uf
        ORDER BY AVG(CASE WHEN m.populacao > 0 THEN m.pib_mil_reais * 1000.0 / m.populacao ELSE 0 END) DESC
        LIMIT 10
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$;
