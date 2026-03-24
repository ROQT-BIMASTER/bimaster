CREATE OR REPLACE FUNCTION public.get_contas_receber_totais_filtrados(
  p_empresas integer[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_cliente text DEFAULT NULL,
  p_conta text DEFAULT NULL,
  p_portador text DEFAULT NULL,
  p_anos integer[] DEFAULT NULL,
  p_meses integer[] DEFAULT NULL,
  p_dia_vencimento date DEFAULT NULL,
  p_dia_recebimento date DEFAULT NULL,
  p_dia_emissao date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_data_inicio date;
  v_data_fim date;
BEGIN
  -- Date range logic
  IF p_dia_vencimento IS NOT NULL THEN
    v_data_inicio := p_dia_vencimento;
    v_data_fim := p_dia_vencimento;
  ELSIF p_anos IS NULL OR array_length(p_anos, 1) IS NULL THEN
    v_data_inicio := (EXTRACT(YEAR FROM CURRENT_DATE) - 3)::text || '-01-01';
    v_data_fim := (EXTRACT(YEAR FROM CURRENT_DATE) + 1)::text || '-12-31';
  ELSE
    v_data_inicio := (SELECT MIN(a) FROM unnest(p_anos) a)::text || '-01-01';
    v_data_fim := (SELECT MAX(a) FROM unnest(p_anos) a)::text || '-12-31';
  END IF;

  SELECT jsonb_build_object(
    'valor_original', COALESCE(SUM(valor_original), 0),
    'valor_aberto', COALESCE(SUM(valor_aberto), 0),
    'valor_recebido', COALESCE(SUM(valor_recebido), 0),
    'total_registros', COUNT(*)
  ) INTO v_result
  FROM contas_receber
  WHERE data_vencimento >= v_data_inicio
    AND data_vencimento <= v_data_fim
    AND (p_empresas IS NULL OR empresa_id = ANY(p_empresas))
    AND (p_status IS NULL OR status = p_status)
    AND (p_cliente IS NULL OR cliente_nome ILIKE '%' || p_cliente || '%')
    AND (p_conta IS NULL OR conta = p_conta)
    AND (p_portador IS NULL OR portador = p_portador)
    AND (p_dia_recebimento IS NULL OR data_recebimento = p_dia_recebimento)
    AND (p_dia_emissao IS NULL OR data_emissao = p_dia_emissao)
    AND (p_meses IS NULL OR array_length(p_meses, 1) IS NULL OR EXTRACT(MONTH FROM data_vencimento)::integer = ANY(p_meses));

  RETURN v_result;
END;
$$;