-- Dropar e recriar função para incluir meses futuros
DROP FUNCTION IF EXISTS get_contas_receber_evolucao_mensal(integer[], integer, text, text);

CREATE FUNCTION get_contas_receber_evolucao_mensal(
  p_empresas integer[] DEFAULT NULL,
  p_ano integer DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_portador text DEFAULT NULL
)
RETURNS TABLE(mes text, recebido numeric, pendente numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date date;
  v_end_date date;
BEGIN
  -- Calcular período: ano completo se especificado, senão 6 meses atrás até 6 meses à frente
  IF p_ano IS NOT NULL THEN
    v_start_date := make_date(p_ano, 1, 1);
    v_end_date := make_date(p_ano, 12, 31);
  ELSE
    v_start_date := date_trunc('month', current_date - interval '6 months')::date;
    v_end_date := (date_trunc('month', current_date + interval '6 months') + interval '1 month' - interval '1 day')::date;
  END IF;

  RETURN QUERY
  WITH meses AS (
    SELECT generate_series(
      date_trunc('month', v_start_date),
      date_trunc('month', v_end_date),
      interval '1 month'
    )::date AS mes_inicio
  ),
  dados AS (
    SELECT 
      date_trunc('month', COALESCE(data_recebimento, data_vencimento)::date)::date AS mes_ref,
      COALESCE(SUM(CASE WHEN lower(status) = 'recebido' THEN valor_recebido ELSE 0 END), 0) AS valor_recebido,
      COALESCE(SUM(CASE WHEN lower(status) IN ('pendente', 'vencido', 'parcial') THEN valor_aberto ELSE 0 END), 0) AS valor_pendente
    FROM contas_receber
    WHERE 
      COALESCE(data_recebimento, data_vencimento) >= v_start_date
      AND COALESCE(data_recebimento, data_vencimento) <= v_end_date
      AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))
      AND (p_conta IS NULL OR conta = p_conta)
      AND (p_portador IS NULL OR portador = p_portador)
    GROUP BY date_trunc('month', COALESCE(data_recebimento, data_vencimento)::date)
  )
  SELECT 
    to_char(m.mes_inicio, 'Mon/YY') AS mes,
    COALESCE(d.valor_recebido, 0) AS recebido,
    COALESCE(d.valor_pendente, 0) AS pendente
  FROM meses m
  LEFT JOIN dados d ON d.mes_ref = m.mes_inicio
  ORDER BY m.mes_inicio;
END;
$$;