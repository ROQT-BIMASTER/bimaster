
CREATE OR REPLACE FUNCTION public.get_total_a_receber(
  p_incluir_vencidos BOOLEAN DEFAULT true,
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_empresa_ids INTEGER[];
BEGIN
  -- Get user's empresa IDs
  v_empresa_ids := get_empresa_ids_do_usuario();

  SELECT jsonb_build_object(
    'total_pendente', COALESCE(SUM(CASE WHEN status = 'pendente' THEN valor_aberto END), 0),
    'total_vencido', COALESCE(SUM(CASE WHEN status = 'vencido' THEN valor_aberto END), 0),
    'total_parcial', COALESCE(SUM(CASE WHEN status = 'parcial' THEN valor_aberto END), 0),
    'total_aberto', COALESCE(SUM(valor_aberto), 0),
    'count_pendente', COUNT(*) FILTER (WHERE status = 'pendente'),
    'count_vencido', COUNT(*) FILTER (WHERE status = 'vencido'),
    'count_parcial', COUNT(*) FILTER (WHERE status = 'parcial'),
    'count_total', COUNT(*)
  )
  INTO v_result
  FROM contas_receber
  WHERE status IN ('pendente', 'vencido', 'parcial')
    AND empresa_id = ANY(v_empresa_ids)
    AND (p_data_inicio IS NULL OR data_vencimento >= p_data_inicio)
    AND (p_data_fim IS NULL OR data_vencimento <= p_data_fim)
    AND (p_incluir_vencidos = true OR status != 'vencido');

  RETURN COALESCE(v_result, '{"total_pendente":0,"total_vencido":0,"total_parcial":0,"total_aberto":0,"count_pendente":0,"count_vencido":0,"count_parcial":0,"count_total":0}'::jsonb);
END;
$$;
