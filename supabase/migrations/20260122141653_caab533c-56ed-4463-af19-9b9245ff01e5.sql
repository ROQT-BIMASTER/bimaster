-- Correção: DROP de ambas as funções antes de recriar

-- DROP ambas as funções
DROP FUNCTION IF EXISTS public.get_contas_receber_calendario(INTEGER[], INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_contas_receber_status_dist(INTEGER[], INTEGER, INTEGER, TEXT, TEXT);

-- Recriar função get_contas_receber_calendario corrigida
CREATE FUNCTION public.get_contas_receber_calendario(
  p_empresas INTEGER[] DEFAULT NULL,
  p_ano INTEGER DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_portador TEXT DEFAULT NULL
)
RETURNS TABLE (
  data_vencimento DATE,
  qtd_titulos BIGINT,
  valor_total NUMERIC,
  qtd_vencido BIGINT,
  valor_vencido NUMERIC,
  qtd_pendente BIGINT,
  valor_pendente NUMERIC,
  qtd_recebido BIGINT,
  valor_recebido NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.data_vencimento::DATE,
    COUNT(*)::BIGINT AS qtd_titulos,
    SUM(CASE 
      WHEN LOWER(cr.status) = 'recebido' THEN COALESCE(cr.valor_recebido, cr.valor_original)
      ELSE COALESCE(cr.valor_aberto, cr.valor_original)
    END)::NUMERIC AS valor_total,
    COUNT(*) FILTER (WHERE LOWER(cr.status) = 'vencido')::BIGINT AS qtd_vencido,
    COALESCE(SUM(cr.valor_aberto) FILTER (WHERE LOWER(cr.status) = 'vencido'), 0)::NUMERIC AS valor_vencido,
    COUNT(*) FILTER (WHERE LOWER(cr.status) IN ('pendente', 'parcial'))::BIGINT AS qtd_pendente,
    COALESCE(SUM(cr.valor_aberto) FILTER (WHERE LOWER(cr.status) IN ('pendente', 'parcial')), 0)::NUMERIC AS valor_pendente,
    COUNT(*) FILTER (WHERE LOWER(cr.status) = 'recebido')::BIGINT AS qtd_recebido,
    COALESCE(SUM(cr.valor_recebido) FILTER (WHERE LOWER(cr.status) = 'recebido'), 0)::NUMERIC AS valor_recebido
  FROM contas_receber cr
  WHERE 
    (p_empresas IS NULL OR cr.empresa_id = ANY(p_empresas))
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM cr.data_vencimento) = p_ano)
    AND (p_conta IS NULL OR cr.conta = p_conta)
    AND (p_portador IS NULL OR cr.portador = p_portador)
  GROUP BY cr.data_vencimento::DATE
  ORDER BY cr.data_vencimento::DATE;
END;
$$;

-- Recriar função get_contas_receber_status_dist corrigida
CREATE FUNCTION public.get_contas_receber_status_dist(
  p_empresas INTEGER[] DEFAULT NULL,
  p_ano INTEGER DEFAULT NULL,
  p_mes INTEGER DEFAULT NULL,
  p_conta TEXT DEFAULT NULL,
  p_portador TEXT DEFAULT NULL
)
RETURNS TABLE (
  status TEXT,
  quantidade BIGINT,
  valor NUMERIC,
  percentual NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN LOWER(cr.status) = 'recebido' THEN COALESCE(cr.valor_recebido, cr.valor_original)
      ELSE COALESCE(cr.valor_original, 0)
    END
  ), 0) INTO v_total
  FROM contas_receber cr
  WHERE 
    (p_empresas IS NULL OR cr.empresa_id = ANY(p_empresas))
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM cr.data_vencimento) = p_ano)
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM cr.data_vencimento) = p_mes)
    AND (p_conta IS NULL OR cr.conta = p_conta)
    AND (p_portador IS NULL OR cr.portador = p_portador);

  RETURN QUERY
  SELECT 
    CASE 
      WHEN LOWER(cr.status) = 'recebido' THEN 'Recebido'
      WHEN LOWER(cr.status) = 'vencido' THEN 'Vencido'
      WHEN LOWER(cr.status) = 'parcial' THEN 'Parcial'
      ELSE 'Pendente'
    END AS status_calc,
    COUNT(*)::BIGINT AS quantidade,
    SUM(CASE 
      WHEN LOWER(cr.status) = 'recebido' THEN COALESCE(cr.valor_recebido, cr.valor_original)
      ELSE COALESCE(cr.valor_original, 0)
    END)::NUMERIC AS valor,
    CASE WHEN v_total > 0 THEN 
      ROUND((SUM(CASE 
        WHEN LOWER(cr.status) = 'recebido' THEN COALESCE(cr.valor_recebido, cr.valor_original)
        ELSE COALESCE(cr.valor_original, 0)
      END) / v_total * 100)::NUMERIC, 2)
    ELSE 0 END AS percentual
  FROM contas_receber cr
  WHERE 
    (p_empresas IS NULL OR cr.empresa_id = ANY(p_empresas))
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM cr.data_vencimento) = p_ano)
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM cr.data_vencimento) = p_mes)
    AND (p_conta IS NULL OR cr.conta = p_conta)
    AND (p_portador IS NULL OR cr.portador = p_portador)
  GROUP BY status_calc
  ORDER BY valor DESC;
END;
$$;