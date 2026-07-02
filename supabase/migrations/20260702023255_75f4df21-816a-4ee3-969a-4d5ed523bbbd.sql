
-- ============ A1. coluna cliente_uf =============
ALTER TABLE public.erp_vendas ADD COLUMN IF NOT EXISTS cliente_uf text;
CREATE INDEX IF NOT EXISTS idx_erp_vendas_uf ON public.erp_vendas(cliente_uf);

-- Recriar v_vendas incluindo cliente_uf
DROP VIEW IF EXISTS public.v_vendas CASCADE;
CREATE VIEW public.v_vendas AS
SELECT v.futura_nota_id,
       v.empresa_id,
       v.nro_nota,
       v.serie,
       v.data_emissao,
       v.cliente_futura_id,
       v.cliente_nome,
       v.cliente_cnpj_cpf,
       v.cliente_uf,
       v.vendedor_futura_id,
       vd.id AS vendedor_id,
       vd.nome AS vendedor_nome,
       vd.coordenador_id,
       c.nome AS coordenador_nome,
       v.tabela_preco_id,
       v.tabela_preco_nome,
       v.quantidade,
       v.total_produto,
       v.total_desconto,
       v.total_nota,
       v.status,
       v.sincronizado_em
FROM public.erp_vendas v
LEFT JOIN public.vendedores vd ON vd.futura_id = v.vendedor_futura_id
LEFT JOIN public.coordenadores c ON c.id = vd.coordenador_id
WHERE v.entrada_saida = 'S'::bpchar AND v.status = 1;

GRANT SELECT ON public.v_vendas TO authenticated;

-- ============ A2. RPCs com filtros globais =============
-- Drop antigas assinaturas (CASCADE não é necessário; nenhuma view depende delas)
DROP FUNCTION IF EXISTS public.vendas_kpis(date,date,integer,uuid,uuid);
DROP FUNCTION IF EXISTS public.vendas_ranking_vendedor(date,date,integer,uuid);
DROP FUNCTION IF EXISTS public.vendas_ranking_cliente(date,date,integer);
DROP FUNCTION IF EXISTS public.vendas_serie_mensal(date,date,integer,uuid,uuid);
DROP FUNCTION IF EXISTS public.vendas_top_clientes(date,date,integer,uuid,uuid,integer);
DROP FUNCTION IF EXISTS public.vendas_yoy_por_dimensao(text,integer,integer);
DROP FUNCTION IF EXISTS public.vendas_share_tabela_preco(date,date,integer);

-- vendas_kpis
CREATE OR REPLACE FUNCTION public.vendas_kpis(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_tabela_preco integer DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_cliente integer DEFAULT NULL,
  p_vendedor integer DEFAULT NULL
)
RETURNS TABLE(faturamento numeric, faturamento_com_impostos numeric, notas bigint, ticket_medio numeric, qtd_total numeric, qtd_un numeric, clientes bigint, vendedores bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH hdr AS (
    SELECT v.futura_nota_id, v.total_produto, v.total_nota, v.quantidade,
           v.cliente_futura_id, v.vendedor_id
    FROM v_vendas v
    WHERE (p_de IS NULL OR v.data_emissao >= p_de)
      AND (p_ate IS NULL OR v.data_emissao <= p_ate)
      AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
      AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
      AND (p_uf IS NULL OR v.cliente_uf = p_uf)
      AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
      AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
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

-- vendas_ranking_vendedor
CREATE OR REPLACE FUNCTION public.vendas_ranking_vendedor(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_tabela_preco integer DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_cliente integer DEFAULT NULL,
  p_vendedor integer DEFAULT NULL
)
RETURNS TABLE(vendedor_id uuid, vendedor_nome text, coordenador_id uuid, coordenador_nome text, notas bigint, faturamento numeric, faturamento_com_impostos numeric, ticket_medio numeric, qtd_un numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
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
      AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
      AND (p_uf IS NULL OR v.cliente_uf = p_uf)
      AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
      AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
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

-- vendas_ranking_cliente
CREATE OR REPLACE FUNCTION public.vendas_ranking_cliente(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_tabela_preco integer DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_cliente integer DEFAULT NULL,
  p_vendedor integer DEFAULT NULL
)
RETURNS TABLE(cliente_id integer, cliente_nome text, notas bigint, faturamento numeric, ticket_medio numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
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
    AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
    AND (p_uf IS NULL OR v.cliente_uf = p_uf)
    AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
    AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
    AND v.cliente_futura_id IS NOT NULL
  GROUP BY v.cliente_futura_id, v.cliente_nome
  ORDER BY faturamento DESC;
$$;

-- vendas_serie_mensal
CREATE OR REPLACE FUNCTION public.vendas_serie_mensal(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_tabela_preco integer DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_cliente integer DEFAULT NULL,
  p_vendedor integer DEFAULT NULL
)
RETURNS TABLE(mes date, faturamento numeric, faturamento_com_impostos numeric, notas bigint, ticket_medio numeric, qtd_un numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH hdr AS (
    SELECT v.futura_nota_id, date_trunc('month', v.data_emissao)::date AS mes,
           v.total_produto, v.total_nota
    FROM v_vendas v
    WHERE (p_de IS NULL OR v.data_emissao >= p_de)
      AND (p_ate IS NULL OR v.data_emissao <= p_ate)
      AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
      AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
      AND (p_uf IS NULL OR v.cliente_uf = p_uf)
      AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
      AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
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

-- vendas_top_clientes
CREATE OR REPLACE FUNCTION public.vendas_top_clientes(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_tabela_preco integer DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_cliente integer DEFAULT NULL,
  p_vendedor integer DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE(cliente_futura_id integer, cliente_nome text, cliente_cnpj_cpf text, notas bigint, faturamento numeric, faturamento_com_impostos numeric, qtd_un numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH hdr AS (
    SELECT v.futura_nota_id, v.cliente_futura_id, v.cliente_nome, v.cliente_cnpj_cpf,
           v.total_produto, v.total_nota
    FROM v_vendas v
    WHERE (p_de IS NULL OR v.data_emissao >= p_de)
      AND (p_ate IS NULL OR v.data_emissao <= p_ate)
      AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
      AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
      AND (p_uf IS NULL OR v.cliente_uf = p_uf)
      AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
      AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
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

-- vendas_yoy_por_dimensao
CREATE OR REPLACE FUNCTION public.vendas_yoy_por_dimensao(
  p_dim text DEFAULT 'cliente',
  p_ano integer DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_tabela_preco integer DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_cliente integer DEFAULT NULL,
  p_vendedor integer DEFAULT NULL
)
RETURNS TABLE(chave integer, nome text, fat_atual numeric, fat_anterior numeric, variacao numeric, notas_atual bigint, novo boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_ano int;
  v_mmax int;
BEGIN
  v_ano := COALESCE(p_ano, EXTRACT(YEAR FROM CURRENT_DATE)::int);

  SELECT COALESCE(MAX(EXTRACT(MONTH FROM data_emissao))::int, 12)
    INTO v_mmax
  FROM public.v_vendas
  WHERE EXTRACT(YEAR FROM data_emissao) = v_ano
    AND (p_empresa IS NULL OR empresa_id = p_empresa);

  RETURN QUERY
  SELECT
    CASE WHEN p_dim = 'vendedor' THEN v.vendedor_futura_id
         ELSE v.cliente_futura_id END AS chave,
    MAX(CASE WHEN p_dim = 'vendedor' THEN v.vendedor_nome
             ELSE v.cliente_nome END) AS nome,
    COALESCE(SUM(v.total_nota) FILTER (
      WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano
    ), 0) AS fat_atual,
    COALESCE(SUM(v.total_nota) FILTER (
      WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano - 1
        AND EXTRACT(MONTH FROM v.data_emissao) <= v_mmax
    ), 0) AS fat_anterior,
    NULL::numeric AS variacao,
    COUNT(*) FILTER (
      WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano
    ) AS notas_atual,
    false AS novo
  FROM public.v_vendas v
  WHERE (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
    AND (p_uf IS NULL OR v.cliente_uf = p_uf)
    AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
    AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
    AND EXTRACT(YEAR FROM v.data_emissao) IN (v_ano, v_ano - 1)
  GROUP BY 1
  HAVING COALESCE(SUM(v.total_nota) FILTER (
    WHERE EXTRACT(YEAR FROM v.data_emissao) = v_ano
  ), 0) > 0
  ORDER BY fat_atual DESC;
END;
$$;

-- vendas_share_tabela_preco
CREATE OR REPLACE FUNCTION public.vendas_share_tabela_preco(
  p_de date DEFAULT NULL,
  p_ate date DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_tabela_preco integer DEFAULT NULL,
  p_uf text DEFAULT NULL,
  p_cliente integer DEFAULT NULL,
  p_vendedor integer DEFAULT NULL
)
RETURNS TABLE(tabela_preco_id integer, tabela_preco_nome text, notas bigint, faturamento numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    v.tabela_preco_id,
    COALESCE(v.tabela_preco_nome, '(sem tabela)') AS tabela_preco_nome,
    COUNT(*)::bigint AS notas,
    COALESCE(SUM(v.total_nota), 0) AS faturamento
  FROM public.v_vendas v
  WHERE (p_de IS NULL OR v.data_emissao >= p_de)
    AND (p_ate IS NULL OR v.data_emissao <= p_ate)
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
    AND (p_uf IS NULL OR v.cliente_uf = p_uf)
    AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
    AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
  GROUP BY v.tabela_preco_id, v.tabela_preco_nome
  ORDER BY faturamento DESC;
$$;

-- ============ A3. RPC nova: vendas_uf_yoy =============
CREATE OR REPLACE FUNCTION public.vendas_uf_yoy(
  p_ano integer DEFAULT NULL,
  p_empresa integer DEFAULT NULL,
  p_tabela_preco integer DEFAULT NULL,
  p_cliente integer DEFAULT NULL,
  p_vendedor integer DEFAULT NULL
)
RETURNS TABLE(uf text, fat_atual numeric, fat_anterior numeric, notas_atual bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_ano int;
  v_mmax int;
BEGIN
  v_ano := COALESCE(p_ano, EXTRACT(YEAR FROM CURRENT_DATE)::int);
  v_mmax := CASE WHEN v_ano = EXTRACT(YEAR FROM CURRENT_DATE)::int
                 THEN GREATEST(EXTRACT(MONTH FROM CURRENT_DATE)::int - 1, 1)
                 ELSE 12 END;

  RETURN QUERY
  SELECT COALESCE(v.cliente_uf,'—') AS uf,
    COALESCE(SUM(v.total_nota) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano   AND EXTRACT(MONTH FROM v.data_emissao)<=v_mmax),0)::numeric AS fat_atual,
    COALESCE(SUM(v.total_nota) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano-1 AND EXTRACT(MONTH FROM v.data_emissao)<=v_mmax),0)::numeric AS fat_anterior,
    COUNT(*) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano AND EXTRACT(MONTH FROM v.data_emissao)<=v_mmax)::bigint AS notas_atual
  FROM public.v_vendas v
  WHERE EXTRACT(YEAR FROM v.data_emissao) IN (v_ano, v_ano-1)
    AND EXTRACT(MONTH FROM v.data_emissao) <= v_mmax
    AND (p_empresa IS NULL OR v.empresa_id = p_empresa)
    AND (p_tabela_preco IS NULL OR v.tabela_preco_id = p_tabela_preco)
    AND (p_cliente IS NULL OR v.cliente_futura_id = p_cliente)
    AND (p_vendedor IS NULL OR v.vendedor_futura_id = p_vendedor)
  GROUP BY v.cliente_uf
  HAVING COALESCE(SUM(v.total_nota) FILTER (WHERE EXTRACT(YEAR FROM v.data_emissao)=v_ano AND EXTRACT(MONTH FROM v.data_emissao)<=v_mmax),0) > 0
  ORDER BY fat_atual DESC;
END;
$$;

-- ============ Grants =============
GRANT EXECUTE ON FUNCTION public.vendas_kpis(date,date,integer,integer,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_ranking_vendedor(date,date,integer,integer,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_ranking_cliente(date,date,integer,integer,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_serie_mensal(date,date,integer,integer,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_top_clientes(date,date,integer,integer,text,integer,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_yoy_por_dimensao(text,integer,integer,integer,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_share_tabela_preco(date,date,integer,integer,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendas_uf_yoy(integer,integer,integer,integer,integer) TO authenticated;
