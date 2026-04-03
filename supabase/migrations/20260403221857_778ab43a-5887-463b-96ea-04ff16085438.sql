
-- Drop old RPC
DROP FUNCTION IF EXISTS public.get_contas_receber_dre(date, date, text, text);

-- RPC 1: Totals by month (max ~12 rows per year)
CREATE OR REPLACE FUNCTION public.get_contas_receber_dre_totais(
  p_data_inicio date,
  p_data_fim date,
  p_empresa_nome text DEFAULT NULL
)
RETURNS TABLE(
  mes text,
  valor_original numeric,
  valor_recebido numeric,
  qtd_documentos bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    to_char(cr.data_recebimento, 'YYYY-MM'),
    SUM(cr.valor_original),
    SUM(COALESCE(cr.valor_recebido, 0)),
    COUNT(*)
  FROM contas_receber cr
  WHERE 
    cr.status = 'recebido'
    AND cr.data_recebimento >= p_data_inicio 
    AND cr.data_recebimento <= p_data_fim
    AND (p_empresa_nome IS NULL OR cr.empresa_nome = p_empresa_nome)
  GROUP BY 1
  ORDER BY 1
$$;

-- RPC 2: Top 50 clients for drill-down
CREATE OR REPLACE FUNCTION public.get_contas_receber_dre_clientes(
  p_data_inicio date,
  p_data_fim date,
  p_empresa_nome text DEFAULT NULL
)
RETURNS TABLE(
  cliente_codigo text,
  cliente_nome text,
  valor_original numeric,
  valor_recebido numeric,
  qtd_documentos bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(cr.cliente_codigo::text, 'sem-cliente'),
    COALESCE(cr.cliente_nome, 'Cliente não identificado'),
    SUM(cr.valor_original),
    SUM(COALESCE(cr.valor_recebido, 0)),
    COUNT(*)
  FROM contas_receber cr
  WHERE 
    cr.status = 'recebido'
    AND cr.data_recebimento >= p_data_inicio 
    AND cr.data_recebimento <= p_data_fim
    AND (p_empresa_nome IS NULL OR cr.empresa_nome = p_empresa_nome)
  GROUP BY 1, 2
  ORDER BY 4 DESC
  LIMIT 50
$$;
