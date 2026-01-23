-- ============================================================
-- RPC para buscar listas de filtros (empresas, contas, portadores)
-- Muito mais leve que carregar todos os registros
-- ============================================================

CREATE OR REPLACE FUNCTION get_contas_receber_filter_options(
  p_anos int[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  -- Definir período baseado nos anos
  IF p_anos IS NULL OR array_length(p_anos, 1) IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || '-12-31';
  ELSE
    v_data_inicio := (SELECT MIN(a) FROM unnest(p_anos) AS a)::text || '-01-01';
    v_data_fim := (SELECT MAX(a) FROM unnest(p_anos) AS a)::text || '-12-31';
  END IF;

  WITH base AS (
    SELECT DISTINCT empresa_id, empresa_nome, conta, portador
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio
      AND data_vencimento <= v_data_fim
  ),
  empresas AS (
    SELECT jsonb_agg(DISTINCT jsonb_build_object('id', empresa_id, 'nome', empresa_nome)) 
    FROM base WHERE empresa_id IS NOT NULL AND empresa_nome IS NOT NULL
  ),
  contas AS (
    SELECT jsonb_agg(DISTINCT conta ORDER BY conta) 
    FROM base WHERE conta IS NOT NULL AND conta != ''
  ),
  portadores AS (
    SELECT jsonb_agg(DISTINCT portador ORDER BY portador) 
    FROM base WHERE portador IS NOT NULL AND portador != ''
  )
  SELECT jsonb_build_object(
    'empresas', COALESCE((SELECT * FROM empresas), '[]'::jsonb),
    'contas', COALESCE((SELECT * FROM contas), '[]'::jsonb),
    'portadores', COALESCE((SELECT * FROM portadores), '[]'::jsonb)
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;