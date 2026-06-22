CREATE OR REPLACE FUNCTION public.vendas_kpis(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL,
  p_empresa int DEFAULT NULL, p_vendedor uuid DEFAULT NULL, p_coordenador uuid DEFAULT NULL)
RETURNS TABLE (faturamento numeric, notas bigint, ticket_medio numeric,
               qtd_total numeric, clientes bigint, vendedores bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    COALESCE(SUM(total_nota),0)::numeric,
    COUNT(*)::bigint,
    CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(total_nota),0) / COUNT(*), 2) ELSE 0 END,
    COALESCE(SUM(quantidade),0)::numeric,
    COUNT(DISTINCT cliente_futura_id)::bigint,
    COUNT(DISTINCT vendedor_id)::bigint
  FROM v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_vendedor IS NULL OR v.vendedor_id = p_vendedor)
    AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador);
$$;

CREATE OR REPLACE FUNCTION public.vendas_ranking_vendedor(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL,
  p_empresa int DEFAULT NULL, p_coordenador uuid DEFAULT NULL)
RETURNS TABLE (vendedor_id uuid, vendedor_nome text, coordenador_nome text,
               notas bigint, faturamento numeric, ticket_medio numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT v.vendedor_id,
         COALESCE(v.vendedor_nome, 'Sem vendedor'),
         v.coordenador_nome,
         COUNT(*)::bigint,
         COALESCE(SUM(v.total_nota),0)::numeric,
         CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(v.total_nota),0)/COUNT(*),2) ELSE 0 END
  FROM v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador)
  GROUP BY v.vendedor_id, v.vendedor_nome, v.coordenador_nome
  ORDER BY 5 DESC;
$$;

CREATE OR REPLACE FUNCTION public.vendas_ranking_coordenador(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_empresa int DEFAULT NULL)
RETURNS TABLE (coordenador_id uuid, coordenador_nome text, notas bigint, faturamento numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT v.coordenador_id,
         COALESCE(v.coordenador_nome, 'Sem coordenador'),
         COUNT(*)::bigint,
         COALESCE(SUM(v.total_nota),0)::numeric
  FROM v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
  GROUP BY v.coordenador_id, v.coordenador_nome
  ORDER BY 4 DESC;
$$;

CREATE OR REPLACE FUNCTION public.vendas_serie_mensal(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL,
  p_empresa int DEFAULT NULL, p_vendedor uuid DEFAULT NULL, p_coordenador uuid DEFAULT NULL)
RETURNS TABLE (mes date, faturamento numeric, notas bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT date_trunc('month', v.data_emissao)::date,
         COALESCE(SUM(v.total_nota),0)::numeric,
         COUNT(*)::bigint
  FROM v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_vendedor IS NULL OR v.vendedor_id = p_vendedor)
    AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador)
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.vendas_top_clientes(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL,
  p_empresa int DEFAULT NULL, p_vendedor uuid DEFAULT NULL, p_coordenador uuid DEFAULT NULL,
  p_limite int DEFAULT 10)
RETURNS TABLE (cliente_futura_id int, cliente_nome text, notas bigint, faturamento numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT v.cliente_futura_id, COALESCE(v.cliente_nome, '(sem cliente)'),
         COUNT(*)::bigint, COALESCE(SUM(v.total_nota),0)::numeric
  FROM v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_vendedor IS NULL OR v.vendedor_id = p_vendedor)
    AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador)
  GROUP BY v.cliente_futura_id, v.cliente_nome
  ORDER BY 4 DESC
  LIMIT p_limite;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_kpis(date,date,int,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_ranking_vendedor(date,date,int,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_ranking_coordenador(date,date,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_serie_mensal(date,date,int,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_top_clientes(date,date,int,uuid,uuid,int) TO authenticated;