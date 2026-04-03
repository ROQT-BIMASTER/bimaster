CREATE OR REPLACE FUNCTION public.get_contas_receber_dre(
  p_data_inicio date,
  p_data_fim date,
  p_regime text DEFAULT 'competencia',
  p_empresa_nome text DEFAULT NULL
)
RETURNS TABLE(
  cliente_codigo text,
  cliente_nome text,
  mes text,
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
  GROUP BY 1, 2, 3
$$;