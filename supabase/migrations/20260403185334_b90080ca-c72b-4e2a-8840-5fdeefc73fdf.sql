
CREATE OR REPLACE FUNCTION public.get_financeiro_dashboard_totais()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresas integer[];
  v_result jsonb;
BEGIN
  v_empresas := get_empresa_ids_do_usuario();

  SELECT jsonb_build_object(
    'total_pendente', COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor_aberto ELSE 0 END), 0),
    'total_vencido', COALESCE(SUM(CASE WHEN status = 'vencido' THEN valor_aberto ELSE 0 END), 0),
    'total_parcial', COALESCE(SUM(CASE WHEN status = 'parcial' THEN valor_aberto ELSE 0 END), 0),
    'recebido_hoje', COALESCE(SUM(CASE WHEN status = 'recebido' AND data_recebimento::date = CURRENT_DATE THEN valor_recebido ELSE 0 END), 0),
    'recebido_mes', COALESCE(SUM(CASE WHEN status = 'recebido' AND date_trunc('month', data_recebimento) = date_trunc('month', CURRENT_DATE) THEN valor_recebido ELSE 0 END), 0),
    'count_pendente', COUNT(CASE WHEN status = 'pendente' THEN 1 END),
    'count_vencido', COUNT(CASE WHEN status = 'vencido' THEN 1 END),
    'count_parcial', COUNT(CASE WHEN status = 'parcial' THEN 1 END)
  ) INTO v_result
  FROM contas_receber
  WHERE empresa_id = ANY(v_empresas);

  RETURN v_result;
END;
$$;
