
DROP FUNCTION IF EXISTS public.vendas_kpis(date,date,integer,uuid,uuid);
DROP FUNCTION IF EXISTS public.vendas_serie_mensal(date,date,integer,uuid,uuid);
DROP FUNCTION IF EXISTS public.vendas_ranking_vendedor(date,date,integer,uuid);
DROP FUNCTION IF EXISTS public.vendas_ranking_coordenador(date,date,integer);
DROP FUNCTION IF EXISTS public.vendas_top_clientes(date,date,integer,uuid,uuid,integer);
DROP FUNCTION IF EXISTS public.vendas_serie_mensal_cliente(integer,date);

CREATE OR REPLACE FUNCTION public.vendas_kpis(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL, p_vendedor uuid DEFAULT NULL,
  p_coordenador uuid DEFAULT NULL
)
RETURNS TABLE(
  faturamento numeric, faturamento_com_impostos numeric,
  notas bigint, ticket_medio numeric,
  qtd_total numeric, qtd_un numeric,
  clientes bigint, vendedores bigint
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH hdr AS (
    SELECT v.futura_nota_id, v.total_produto, v.total_nota, v.quantidade,
           v.cliente_futura_id, v.vendedor_id
    FROM v_vendas v
    WHERE (p_de IS NULL OR v.data_emissao >= p_de)
      AND (p_ate IS NULL OR v.data_emissao <= p_ate)
      AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
      AND (p_vendedor IS NULL OR v.vendedor_id = p_vendedor)
      AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador)
  ),
  itens AS (
    SELECT COALESCE(SUM(vi.quantidade_un),0)::numeric AS qtd_un
    FROM erp_vendas_item vi
    WHERE vi.futura_nota_id IN (SELECT futura_nota_id FROM hdr)
  )
  SELECT
    COALESCE(SUM(h.total_produto),0)::numeric,
    COALESCE(SUM(h.total_nota),0)::numeric,
    COUNT(*)::bigint,
    CASE WHEN COUNT(*)>0 THEN ROUND(COALESCE(SUM(h.total_produto),0)/COUNT(*),2) ELSE 0 END,
    COALESCE(SUM(h.quantidade),0)::numeric,
    (SELECT qtd_un FROM itens),
    COUNT(DISTINCT h.cliente_futura_id)::bigint,
    COUNT(DISTINCT h.vendedor_id)::bigint
  FROM hdr h;
$$;

CREATE OR REPLACE FUNCTION public.vendas_serie_mensal(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL, p_vendedor uuid DEFAULT NULL,
  p_coordenador uuid DEFAULT NULL
)
RETURNS TABLE(
  mes date, faturamento numeric, faturamento_com_impostos numeric,
  notas bigint, ticket_medio numeric, qtd_un numeric
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH hdr AS (
    SELECT v.futura_nota_id, date_trunc('month', v.data_emissao)::date AS mes,
           v.total_produto, v.total_nota
    FROM v_vendas v
    WHERE (p_de IS NULL OR v.data_emissao >= p_de)
      AND (p_ate IS NULL OR v.data_emissao <= p_ate)
      AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
      AND (p_vendedor IS NULL OR v.vendedor_id = p_vendedor)
      AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador)
  ),
  agg AS (
    SELECT mes,
           COALESCE(SUM(total_produto),0)::numeric AS faturamento,
           COALESCE(SUM(total_nota),0)::numeric AS faturamento_com_impostos,
           COUNT(*)::bigint AS notas,
           CASE WHEN COUNT(*)>0 THEN ROUND(COALESCE(SUM(total_produto),0)/COUNT(*),2) ELSE 0 END AS ticket_medio
    FROM hdr GROUP BY 1
  ),
  itens AS (
    SELECT h.mes, COALESCE(SUM(vi.quantidade_un),0)::numeric AS qtd_un
    FROM erp_vendas_item vi JOIN hdr h ON h.futura_nota_id = vi.futura_nota_id
    GROUP BY h.mes
  )
  SELECT a.mes, a.faturamento, a.faturamento_com_impostos, a.notas, a.ticket_medio,
         COALESCE(i.qtd_un,0)::numeric
  FROM agg a LEFT JOIN itens i ON i.mes = a.mes
  ORDER BY a.mes;
$$;

CREATE OR REPLACE FUNCTION public.vendas_ranking_vendedor(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL, p_coordenador uuid DEFAULT NULL
)
RETURNS TABLE(
  vendedor_id uuid, vendedor_nome text,
  coordenador_id uuid, coordenador_nome text,
  notas bigint, faturamento numeric, faturamento_com_impostos numeric,
  ticket_medio numeric, qtd_un numeric
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH hdr AS (
    SELECT v.futura_nota_id, v.vendedor_id,
           COALESCE(v.vendedor_nome,'Sem vendedor') AS vendedor_nome,
           v.coordenador_id,
           COALESCE(v.coordenador_nome,'Sem coordenador') AS coordenador_nome,
           v.total_produto, v.total_nota
    FROM v_vendas v
    WHERE (p_de IS NULL OR v.data_emissao >= p_de)
      AND (p_ate IS NULL OR v.data_emissao <= p_ate)
      AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
      AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador)
  ),
  agg AS (
    SELECT vendedor_id, vendedor_nome, coordenador_id, coordenador_nome,
           COUNT(*)::bigint AS notas,
           COALESCE(SUM(total_produto),0)::numeric AS faturamento,
           COALESCE(SUM(total_nota),0)::numeric AS faturamento_com_impostos,
           CASE WHEN COUNT(*)>0 THEN ROUND(COALESCE(SUM(total_produto),0)/COUNT(*),2) ELSE 0 END AS ticket_medio
    FROM hdr GROUP BY 1,2,3,4
  ),
  itens AS (
    SELECT h.vendedor_id, COALESCE(SUM(vi.quantidade_un),0)::numeric AS qtd_un
    FROM erp_vendas_item vi JOIN hdr h ON h.futura_nota_id = vi.futura_nota_id
    GROUP BY h.vendedor_id
  )
  SELECT a.vendedor_id, a.vendedor_nome, a.coordenador_id, a.coordenador_nome,
         a.notas, a.faturamento, a.faturamento_com_impostos, a.ticket_medio,
         COALESCE(i.qtd_un,0)::numeric
  FROM agg a LEFT JOIN itens i ON i.vendedor_id IS NOT DISTINCT FROM a.vendedor_id
  ORDER BY a.faturamento DESC;
$$;

CREATE OR REPLACE FUNCTION public.vendas_ranking_coordenador(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL
)
RETURNS TABLE(
  coordenador_id uuid, coordenador_nome text,
  notas bigint, faturamento numeric, faturamento_com_impostos numeric,
  qtd_un numeric
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH hdr AS (
    SELECT v.futura_nota_id, v.coordenador_id,
           COALESCE(v.coordenador_nome,'Sem coordenador') AS coordenador_nome,
           v.total_produto, v.total_nota
    FROM v_vendas v
    WHERE (p_de IS NULL OR v.data_emissao >= p_de)
      AND (p_ate IS NULL OR v.data_emissao <= p_ate)
      AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
  ),
  agg AS (
    SELECT coordenador_id, coordenador_nome,
           COUNT(*)::bigint AS notas,
           COALESCE(SUM(total_produto),0)::numeric AS faturamento,
           COALESCE(SUM(total_nota),0)::numeric AS faturamento_com_impostos
    FROM hdr GROUP BY 1,2
  ),
  itens AS (
    SELECT h.coordenador_id, COALESCE(SUM(vi.quantidade_un),0)::numeric AS qtd_un
    FROM erp_vendas_item vi JOIN hdr h ON h.futura_nota_id = vi.futura_nota_id
    GROUP BY h.coordenador_id
  )
  SELECT a.coordenador_id, a.coordenador_nome, a.notas, a.faturamento,
         a.faturamento_com_impostos, COALESCE(i.qtd_un,0)::numeric
  FROM agg a LEFT JOIN itens i ON i.coordenador_id IS NOT DISTINCT FROM a.coordenador_id
  ORDER BY a.faturamento DESC;
$$;

CREATE OR REPLACE FUNCTION public.vendas_top_clientes(
  p_de date DEFAULT NULL, p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL, p_vendedor uuid DEFAULT NULL,
  p_coordenador uuid DEFAULT NULL, p_limit integer DEFAULT 20
)
RETURNS TABLE(
  cliente_futura_id integer, cliente_nome text, cliente_cnpj_cpf text,
  notas bigint, faturamento numeric, faturamento_com_impostos numeric,
  qtd_un numeric
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH hdr AS (
    SELECT v.futura_nota_id, v.cliente_futura_id, v.cliente_nome, v.cliente_cnpj_cpf,
           v.total_produto, v.total_nota
    FROM v_vendas v
    WHERE (p_de IS NULL OR v.data_emissao >= p_de)
      AND (p_ate IS NULL OR v.data_emissao <= p_ate)
      AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
      AND (p_vendedor IS NULL OR v.vendedor_id = p_vendedor)
      AND (p_coordenador IS NULL OR v.coordenador_id = p_coordenador)
  ),
  agg AS (
    SELECT cliente_futura_id,
           MAX(cliente_nome) AS cliente_nome,
           MAX(cliente_cnpj_cpf) AS cliente_cnpj_cpf,
           COUNT(*)::bigint AS notas,
           COALESCE(SUM(total_produto),0)::numeric AS faturamento,
           COALESCE(SUM(total_nota),0)::numeric AS faturamento_com_impostos
    FROM hdr GROUP BY 1
  ),
  itens AS (
    SELECT h.cliente_futura_id, COALESCE(SUM(vi.quantidade_un),0)::numeric AS qtd_un
    FROM erp_vendas_item vi JOIN hdr h ON h.futura_nota_id = vi.futura_nota_id
    GROUP BY h.cliente_futura_id
  )
  SELECT a.cliente_futura_id, a.cliente_nome, a.cliente_cnpj_cpf,
         a.notas, a.faturamento, a.faturamento_com_impostos,
         COALESCE(i.qtd_un,0)::numeric
  FROM agg a LEFT JOIN itens i ON i.cliente_futura_id = a.cliente_futura_id
  ORDER BY a.faturamento DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.vendas_serie_mensal_cliente(
  p_cliente_futura_id integer, p_desde date DEFAULT NULL
)
RETURNS TABLE(
  mes date, faturamento numeric, faturamento_com_impostos numeric,
  quantidade numeric, notas bigint, qtd_un numeric
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  WITH hdr AS (
    SELECT v.futura_nota_id, date_trunc('month', v.data_emissao)::date AS mes,
           v.total_produto, v.total_nota, v.quantidade
    FROM erp_vendas v
    WHERE v.cliente_futura_id = p_cliente_futura_id
      AND v.entrada_saida = 'S' AND v.status = 1
      AND (p_desde IS NULL OR v.data_emissao >= p_desde)
  ),
  agg AS (
    SELECT mes,
           COALESCE(SUM(total_produto),0)::numeric AS faturamento,
           COALESCE(SUM(total_nota),0)::numeric AS faturamento_com_impostos,
           COALESCE(SUM(quantidade),0)::numeric AS quantidade,
           COUNT(*)::bigint AS notas
    FROM hdr GROUP BY 1
  ),
  itens AS (
    SELECT h.mes, COALESCE(SUM(vi.quantidade_un),0)::numeric AS qtd_un
    FROM erp_vendas_item vi JOIN hdr h ON h.futura_nota_id = vi.futura_nota_id
    GROUP BY h.mes
  )
  SELECT a.mes, a.faturamento, a.faturamento_com_impostos, a.quantidade, a.notas,
         COALESCE(i.qtd_un,0)::numeric
  FROM agg a LEFT JOIN itens i ON i.mes = a.mes
  ORDER BY a.mes;
$$;
