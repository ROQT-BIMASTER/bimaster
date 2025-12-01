-- Corrigir função get_analise_departamentos_completa
DROP FUNCTION IF EXISTS get_analise_departamentos_completa(date, date);

CREATE OR REPLACE FUNCTION get_analise_departamentos_completa(
  p_periodo_inicio date,
  p_periodo_fim date
)
RETURNS TABLE (
  departamento_id uuid,
  departamento_nome varchar,
  tipo varchar,
  valor_total numeric,
  total_transacoes bigint,
  periodo_mes date
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id as departamento_id,
    d.nome::varchar as departamento_nome,
    'despesa'::varchar as tipo,
    COALESCE(SUM(cp.valor_original), 0) as valor_total,
    COUNT(cp.id) as total_transacoes,
    DATE_TRUNC('month', cp.data_vencimento)::date as periodo_mes
  FROM departamentos d
  LEFT JOIN contas_pagar cp ON cp.departamento_id = d.id
    AND cp.data_vencimento >= p_periodo_inicio
    AND cp.data_vencimento <= p_periodo_fim
  WHERE d.ativo = true
  GROUP BY d.id, d.nome, DATE_TRUNC('month', cp.data_vencimento)
  
  UNION ALL
  
  SELECT 
    d.id as departamento_id,
    d.nome::varchar as departamento_nome,
    tf.tipo::varchar,
    COALESCE(SUM(tf.valor), 0) as valor_total,
    COUNT(tf.id) as total_transacoes,
    DATE_TRUNC('month', tf.data_transacao)::date as periodo_mes
  FROM departamentos d
  LEFT JOIN transacoes_financeiras tf ON tf.departamento_id = d.id
    AND tf.data_transacao >= p_periodo_inicio
    AND tf.data_transacao <= p_periodo_fim
  WHERE d.ativo = true
  GROUP BY d.id, d.nome, tf.tipo, DATE_TRUNC('month', tf.data_transacao)
  
  ORDER BY periodo_mes, departamento_nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;