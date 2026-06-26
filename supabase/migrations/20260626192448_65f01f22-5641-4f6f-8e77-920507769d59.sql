-- Drop antigos (shape de retorno mudou) ------------------------------
DROP FUNCTION IF EXISTS public.vendas_kpis(date,date,integer,uuid,uuid);
DROP FUNCTION IF EXISTS public.vendas_serie_mensal(date,date,integer,uuid,uuid);
DROP FUNCTION IF EXISTS public.vendas_ranking_vendedor(date,date,integer,uuid);
DROP FUNCTION IF EXISTS public.vendas_ranking_coordenador(date,date,integer);
DROP FUNCTION IF EXISTS public.vendas_top_clientes(date,date,integer,uuid,uuid,integer);
DROP FUNCTION IF EXISTS public.vendas_serie_mensal_cliente(integer,date);

-- 1) vendas_kpis ------------------------------------------------------
CREATE FUNCTION public.vendas_kpis(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_vendedor uuid DEFAULT NULL,
  p_coordenador uuid DEFAULT NULL
)
RETURNS TABLE(
  faturamento numeric,
  faturamento_com_impostos numeric,
  notas bigint,
  ticket_medio numeric,
  qtd_total numeric,
  clientes bigint,
  vendedores bigint
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT
    COALESCE(SUM(total_produto),0)::numeric,
    COALESCE(SUM(total_nota),0)::numeric,
    COUNT(*)::bigint,
    CASE WHEN COUNT(*) > 0
         THEN ROUND(COALESCE(SUM(total_produto),0) / COUNT(*), 2)
         ELSE 0 END,
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

-- 2) vendas_serie_mensal ---------------------------------------------
CREATE FUNCTION public.vendas_serie_mensal(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_vendedor uuid DEFAULT NULL,
  p_coordenador uuid DEFAULT NULL
)
RETURNS TABLE(
  mes date,
  faturamento numeric,
  faturamento_com_impostos numeric,
  notas bigint,
  ticket_medio numeric
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT date_trunc('month', v.data_emissao)::date,
         COALESCE(SUM(v.total_produto),0)::numeric,
         COALESCE(SUM(v.total_nota),0)::numeric,
         COUNT(*)::bigint,
         CASE WHEN COUNT(*) > 0
              THEN ROUND(COALESCE(SUM(v.total_produto),0)/COUNT(*),2)
              ELSE 0 END
  FROM v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_vendedor IS NULL OR v.vendedor_id = p_vendedor)
    AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador)
  GROUP BY 1 ORDER BY 1;
$$;

-- 3) vendas_ranking_vendedor -----------------------------------------
CREATE FUNCTION public.vendas_ranking_vendedor(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_coordenador uuid DEFAULT NULL
)
RETURNS TABLE(
  vendedor_id uuid,
  vendedor_nome text,
  coordenador_id uuid,
  coordenador_nome text,
  notas bigint,
  faturamento numeric,
  faturamento_com_impostos numeric,
  ticket_medio numeric
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT v.vendedor_id,
         COALESCE(v.vendedor_nome,'Sem vendedor'),
         v.coordenador_id,
         COALESCE(v.coordenador_nome,'Sem coordenador'),
         COUNT(*)::bigint,
         COALESCE(SUM(v.total_produto),0)::numeric,
         COALESCE(SUM(v.total_nota),0)::numeric,
         CASE WHEN COUNT(*)>0
              THEN ROUND(COALESCE(SUM(v.total_produto),0)/COUNT(*),2)
              ELSE 0 END
  FROM v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador)
  GROUP BY 1,2,3,4
  ORDER BY 6 DESC;
$$;

-- 4) vendas_ranking_coordenador --------------------------------------
CREATE FUNCTION public.vendas_ranking_coordenador(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL
)
RETURNS TABLE(
  coordenador_id uuid,
  coordenador_nome text,
  notas bigint,
  faturamento numeric,
  faturamento_com_impostos numeric
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT v.coordenador_id,
         COALESCE(v.coordenador_nome,'Sem coordenador'),
         COUNT(*)::bigint,
         COALESCE(SUM(v.total_produto),0)::numeric,
         COALESCE(SUM(v.total_nota),0)::numeric
  FROM v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
  GROUP BY 1,2
  ORDER BY 4 DESC;
$$;

-- 5) vendas_top_clientes ---------------------------------------------
CREATE FUNCTION public.vendas_top_clientes(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_vendedor uuid DEFAULT NULL,
  p_coordenador uuid DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(
  cliente_futura_id integer,
  cliente_nome text,
  cliente_cnpj_cpf text,
  notas bigint,
  faturamento numeric,
  faturamento_com_impostos numeric
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT v.cliente_futura_id,
         MAX(v.cliente_nome),
         MAX(v.cliente_cnpj_cpf),
         COUNT(*)::bigint,
         COALESCE(SUM(v.total_produto),0)::numeric,
         COALESCE(SUM(v.total_nota),0)::numeric
  FROM v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_vendedor IS NULL OR v.vendedor_id = p_vendedor)
    AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador)
  GROUP BY 1
  ORDER BY 5 DESC
  LIMIT p_limit;
$$;

-- 6) vendas_serie_mensal_cliente --------------------------------------
CREATE FUNCTION public.vendas_serie_mensal_cliente(
  p_cliente_futura_id integer,
  p_desde date DEFAULT NULL
)
RETURNS TABLE(
  mes date,
  faturamento numeric,
  faturamento_com_impostos numeric,
  quantidade numeric,
  notas bigint
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT date_trunc('month', v.data_emissao)::date,
         COALESCE(SUM(v.total_produto),0),
         COALESCE(SUM(v.total_nota),0),
         COALESCE(SUM(v.quantidade),0),
         COUNT(*)
  FROM erp_vendas v
  WHERE v.cliente_futura_id = p_cliente_futura_id
    AND v.entrada_saida = 'S' AND v.status = 1
    AND (p_desde IS NULL OR v.data_emissao >= p_desde)
  GROUP BY 1 ORDER BY 1;
$$;