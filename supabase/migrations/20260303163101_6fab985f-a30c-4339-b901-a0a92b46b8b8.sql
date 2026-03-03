CREATE OR REPLACE FUNCTION public.recalculate_contas_pagar_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_vencido int := 0;
  v_updated_pendente int := 0;
BEGIN
  -- Pendente -> Vencido (data_vencimento passou)
  WITH updated AS (
    UPDATE contas_pagar 
    SET status = 'vencido', updated_at = NOW()
    WHERE status = 'pendente' 
      AND valor_aberto > 0 
      AND data_vencimento < CURRENT_DATE
    RETURNING 1
  )
  SELECT count(*) INTO v_updated_vencido FROM updated;

  -- Vencido -> Pendente (data_vencimento ainda não passou, caso raro de correção)
  WITH updated AS (
    UPDATE contas_pagar 
    SET status = 'pendente', updated_at = NOW()
    WHERE status = 'vencido' 
      AND valor_aberto > 0 
      AND data_vencimento >= CURRENT_DATE
    RETURNING 1
  )
  SELECT count(*) INTO v_updated_pendente FROM updated;

  RETURN jsonb_build_object(
    'pendente_to_vencido', v_updated_vencido,
    'vencido_to_pendente', v_updated_pendente,
    'executed_at', NOW()
  );
END;
$$;