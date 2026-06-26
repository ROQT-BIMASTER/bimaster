CREATE OR REPLACE FUNCTION public.vendas_serie_mensal_cliente(
  p_cliente_futura_id integer,
  p_desde date DEFAULT NULL
)
RETURNS TABLE (mes date, faturamento numeric, quantidade numeric, notas bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT date_trunc('month', v.data_emissao)::date AS mes,
         COALESCE(sum(v.total_nota), 0)  AS faturamento,
         COALESCE(sum(v.quantidade), 0)  AS quantidade,
         count(*)                        AS notas
  FROM erp_vendas v
  WHERE v.cliente_futura_id = p_cliente_futura_id
    AND v.entrada_saida = 'S' AND v.status = 1
    AND (p_desde IS NULL OR v.data_emissao >= p_desde)
  GROUP BY 1 ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_serie_mensal_cliente(integer, date) TO authenticated;