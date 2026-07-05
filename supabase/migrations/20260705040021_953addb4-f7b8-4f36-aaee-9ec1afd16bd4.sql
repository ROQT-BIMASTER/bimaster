
CREATE OR REPLACE VIEW public.v_vendas_rubysp WITH (security_invoker = true) AS
SELECT
  p.rubysp_pedido_id AS venda_id,
  p.empresa_id,
  p.nf_numero,
  COALESCE(p.ts_faturamento, p.data_pedido)::date AS data_venda,
  p.cliente_id, p.cliente_nome, p.cliente_cnpj, p.cliente_cidade, p.cliente_uf,
  p.vendedor_id, p.vendedor_nome,
  p.total_pedido AS total_venda,
  p.etapa
FROM public.erp_pedidos_rubysp p
WHERE p.etapa IN ('faturado','entregue') AND p.bonificacao = false;

GRANT SELECT ON public.v_vendas_rubysp TO authenticated;

-- 1) KPIs
CREATE OR REPLACE FUNCTION public.vendas_kpis_rubysp(p_de date, p_ate date, p_empresa int DEFAULT NULL, p_vendedor int DEFAULT NULL)
RETURNS TABLE(faturamento numeric, notas bigint, ticket_medio numeric, clientes bigint, vendedores bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT COALESCE(SUM(total_venda),0), COUNT(*),
         CASE WHEN COUNT(*)>0 THEN SUM(total_venda)/COUNT(*) ELSE 0 END,
         COUNT(DISTINCT cliente_id), COUNT(DISTINCT vendedor_id)
  FROM v_vendas_rubysp
  WHERE data_venda BETWEEN p_de AND p_ate
    AND (p_empresa IS NULL OR empresa_id=p_empresa)
    AND (p_vendedor IS NULL OR vendedor_id=p_vendedor);
$$;

-- 2) Ranking de vendedor
CREATE OR REPLACE FUNCTION public.vendas_ranking_vendedor_rubysp(p_de date, p_ate date, p_empresa int DEFAULT NULL)
RETURNS TABLE(vendedor_id int, vendedor_nome text, notas bigint, faturamento numeric, ticket_medio numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT vendedor_id, max(vendedor_nome), COUNT(*), COALESCE(SUM(total_venda),0),
         CASE WHEN COUNT(*)>0 THEN SUM(total_venda)/COUNT(*) ELSE 0 END
  FROM v_vendas_rubysp
  WHERE data_venda BETWEEN p_de AND p_ate AND (p_empresa IS NULL OR empresa_id=p_empresa)
  GROUP BY vendedor_id ORDER BY 4 DESC;
$$;

-- 3) Ranking/scatter de cliente
CREATE OR REPLACE FUNCTION public.vendas_ranking_cliente_rubysp(p_de date, p_ate date, p_empresa int DEFAULT NULL, p_vendedor int DEFAULT NULL, p_limite int DEFAULT NULL)
RETURNS TABLE(cliente_id bigint, cliente_nome text, notas bigint, faturamento numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT cliente_id, max(cliente_nome), COUNT(*), COALESCE(SUM(total_venda),0)
  FROM v_vendas_rubysp
  WHERE data_venda BETWEEN p_de AND p_ate
    AND (p_empresa IS NULL OR empresa_id=p_empresa)
    AND (p_vendedor IS NULL OR vendedor_id=p_vendedor)
  GROUP BY cliente_id ORDER BY 4 DESC
  LIMIT COALESCE(p_limite, 1000000);
$$;

-- 4) Série mensal
CREATE OR REPLACE FUNCTION public.vendas_serie_mensal_rubysp(p_de date, p_ate date, p_empresa int DEFAULT NULL, p_vendedor int DEFAULT NULL)
RETURNS TABLE(mes date, faturamento numeric, notas bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  SELECT date_trunc('month', data_venda)::date, COALESCE(SUM(total_venda),0), COUNT(*)
  FROM v_vendas_rubysp
  WHERE data_venda BETWEEN p_de AND p_ate
    AND (p_empresa IS NULL OR empresa_id=p_empresa)
    AND (p_vendedor IS NULL OR vendedor_id=p_vendedor)
  GROUP BY 1 ORDER BY 1;
$$;

-- 5) YoY por dimensão
CREATE OR REPLACE FUNCTION public.vendas_yoy_por_dimensao_rubysp(p_dim text, p_ano int, p_empresa int DEFAULT NULL)
RETURNS TABLE(chave text, nome text, fat_atual numeric, fat_anterior numeric, variacao numeric, notas_atual bigint, novo boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
  WITH base AS (
    SELECT CASE WHEN p_dim='vendedor' THEN vendedor_id::text ELSE cliente_id::text END AS chave,
           CASE WHEN p_dim='vendedor' THEN vendedor_nome ELSE cliente_nome END AS nome,
           total_venda, EXTRACT(year FROM data_venda)::int AS ano
    FROM v_vendas_rubysp
    WHERE (p_empresa IS NULL OR empresa_id=p_empresa)
      AND EXTRACT(year FROM data_venda) IN (p_ano, p_ano-1)
      AND EXTRACT(month FROM data_venda) <= EXTRACT(month FROM CURRENT_DATE)
  )
  SELECT chave, max(nome),
    COALESCE(SUM(total_venda) FILTER (WHERE ano=p_ano),0) AS fat_atual,
    COALESCE(SUM(total_venda) FILTER (WHERE ano=p_ano-1),0) AS fat_anterior,
    CASE WHEN COALESCE(SUM(total_venda) FILTER (WHERE ano=p_ano-1),0)=0 THEN NULL
         ELSE (SUM(total_venda) FILTER (WHERE ano=p_ano) - SUM(total_venda) FILTER (WHERE ano=p_ano-1))
              / NULLIF(SUM(total_venda) FILTER (WHERE ano=p_ano-1),0) END AS variacao,
    COUNT(*) FILTER (WHERE ano=p_ano) AS notas_atual,
    COALESCE(SUM(total_venda) FILTER (WHERE ano=p_ano-1),0)=0 AS novo
  FROM base GROUP BY chave HAVING SUM(total_venda) <> 0 ORDER BY fat_atual DESC;
$$;

GRANT EXECUTE ON FUNCTION public.vendas_kpis_rubysp(date,date,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_ranking_vendedor_rubysp(date,date,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_ranking_cliente_rubysp(date,date,int,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_serie_mensal_rubysp(date,date,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_yoy_por_dimensao_rubysp(text,int,int) TO authenticated;
