-- Criar função para detalhar o cálculo do PMR
CREATE OR REPLACE FUNCTION get_contas_receber_pmr_detalhes(
  p_empresas integer[] DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_mes integer DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_portador text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  -- Definir período baseado nos filtros
  IF p_ano IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 1)::text || '-01-01';
    v_data_fim := CURRENT_DATE;
  ELSIF p_mes IS NULL THEN
    v_data_inicio := p_ano::text || '-01-01';
    v_data_fim := p_ano::text || '-12-31';
  ELSE
    v_data_inicio := p_ano::text || '-' || LPAD(p_mes::text, 2, '0') || '-01';
    v_data_fim := (v_data_inicio + interval '1 month - 1 day')::date;
  END IF;

  WITH base AS (
    SELECT *
    FROM contas_receber
    WHERE data_vencimento >= v_data_inicio
      AND data_vencimento <= v_data_fim
      AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))
      AND (p_conta IS NULL OR conta = p_conta)
      AND (p_portador IS NULL OR portador = p_portador)
      AND LOWER(status) = 'recebido'
      AND data_recebimento IS NOT NULL
      AND data_emissao IS NOT NULL
  ),
  stats AS (
    SELECT
      COUNT(*) AS total_titulos_analisados,
      ROUND(AVG(data_recebimento - data_emissao)) AS pmr_emissao_recebimento,
      ROUND(AVG(data_recebimento - data_vencimento)) AS pmr_vencimento_recebimento,
      MIN(data_recebimento - data_emissao) AS menor_prazo,
      MAX(data_recebimento - data_emissao) AS maior_prazo,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (data_recebimento - data_emissao)) AS mediana_prazo,
      COUNT(*) FILTER (WHERE data_recebimento <= data_vencimento) AS recebidos_no_prazo,
      COUNT(*) FILTER (WHERE data_recebimento > data_vencimento) AS recebidos_em_atraso,
      COALESCE(SUM(valor_recebido) FILTER (WHERE data_recebimento <= data_vencimento), 0) AS valor_no_prazo,
      COALESCE(SUM(valor_recebido) FILTER (WHERE data_recebimento > data_vencimento), 0) AS valor_em_atraso
    FROM base
  ),
  faixas AS (
    SELECT
      COUNT(*) FILTER (WHERE (data_recebimento - data_emissao) <= 15) AS ate_15_dias,
      COUNT(*) FILTER (WHERE (data_recebimento - data_emissao) > 15 AND (data_recebimento - data_emissao) <= 30) AS de_16_a_30_dias,
      COUNT(*) FILTER (WHERE (data_recebimento - data_emissao) > 30 AND (data_recebimento - data_emissao) <= 45) AS de_31_a_45_dias,
      COUNT(*) FILTER (WHERE (data_recebimento - data_emissao) > 45 AND (data_recebimento - data_emissao) <= 60) AS de_46_a_60_dias,
      COUNT(*) FILTER (WHERE (data_recebimento - data_emissao) > 60) AS acima_60_dias
    FROM base
  ),
  por_mes AS (
    SELECT 
      TO_CHAR(data_recebimento, 'YYYY-MM') AS mes,
      COUNT(*) AS qtd,
      ROUND(AVG(data_recebimento - data_emissao)) AS pmr_mes
    FROM base
    GROUP BY TO_CHAR(data_recebimento, 'YYYY-MM')
    ORDER BY mes DESC
    LIMIT 6
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object(
      'data_inicio', v_data_inicio,
      'data_fim', v_data_fim
    ),
    'resumo', (SELECT row_to_json(stats.*) FROM stats),
    'faixas', (SELECT row_to_json(faixas.*) FROM faixas),
    'por_mes', COALESCE((SELECT jsonb_agg(row_to_json(por_mes.*)) FROM por_mes), '[]'::jsonb),
    'formula', 'PMR = Média(Data Recebimento - Data Emissão) para títulos com status Recebido',
    'observacoes', ARRAY[
      'PMR considera apenas títulos efetivamente recebidos',
      'Calcula a diferença em dias entre data de emissão e data de recebimento',
      'Títulos sem data de recebimento ou emissão são excluídos do cálculo',
      'PMR Vencimento: diferença entre vencimento e recebimento (negativo = recebeu antes)'
    ]
  ) INTO v_result;

  RETURN v_result;
END;
$$;