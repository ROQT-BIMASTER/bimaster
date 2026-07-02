CREATE OR REPLACE FUNCTION public.vendas_ranking_cliente(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa int DEFAULT NULL
)
RETURNS TABLE(
  cliente_id int,
  cliente_nome text,
  notas bigint,
  faturamento numeric,
  ticket_medio numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    v.cliente_futura_id AS cliente_id,
    COALESCE(v.cliente_nome, 'Sem cliente') AS cliente_nome,
    COUNT(DISTINCT (v.empresa_id, v.nro_nota, v.serie))::bigint AS notas,
    COALESCE(SUM(v.total_nota), 0)::numeric AS faturamento,
    CASE WHEN COUNT(DISTINCT (v.empresa_id, v.nro_nota, v.serie)) > 0
      THEN (COALESCE(SUM(v.total_nota), 0) / COUNT(DISTINCT (v.empresa_id, v.nro_nota, v.serie)))::numeric
      ELSE 0::numeric
    END AS ticket_medio
  FROM public.v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND v.cliente_futura_id IS NOT NULL
  GROUP BY v.cliente_futura_id, v.cliente_nome
  ORDER BY faturamento DESC;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_ranking_cliente(date, date, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_ranking_cliente(date, date, int) TO service_role;