-- Função para buscar contagem de atividades agregadas por data
CREATE OR REPLACE FUNCTION get_activity_counts_by_date(
  p_start_date DATE,
  p_end_date DATE
) 
RETURNS TABLE (activity_date DATE, activity_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    DATE(data_atividade) as activity_date,
    COUNT(*) as activity_count
  FROM atividades
  WHERE DATE(data_atividade) BETWEEN p_start_date AND p_end_date
  GROUP BY DATE(data_atividade)
  ORDER BY activity_date;
$$;