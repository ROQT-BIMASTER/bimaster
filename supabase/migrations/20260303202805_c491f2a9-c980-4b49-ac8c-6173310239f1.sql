-- 1. Drop the old 1-param version that conflicts
DROP FUNCTION IF EXISTS public.bulk_upsert_contas_pagar_v2(jsonb);

-- 2. Enhance recalculate to also handle pago status
CREATE OR REPLACE FUNCTION public.recalculate_contas_pagar_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_vencido int := 0;
  v_updated_pendente int := 0;
  v_updated_pago int := 0;
  v_updated_parcial int := 0;
BEGIN
  -- Pendente/Vencido -> Pago (valor_aberto = 0 e valor_pago > 0)
  WITH updated AS (
    UPDATE contas_pagar 
    SET status = 'pago', updated_at = NOW()
    WHERE status IN ('pendente', 'vencido') 
      AND valor_aberto = 0 
      AND valor_pago > 0
    RETURNING 1
  )
  SELECT count(*) INTO v_updated_pago FROM updated;

  -- Pendente/Vencido -> Parcial (valor_pago > 0 e valor_aberto > 0)
  WITH updated AS (
    UPDATE contas_pagar 
    SET status = 'parcial', updated_at = NOW()
    WHERE status IN ('pendente', 'vencido') 
      AND valor_pago > 0 
      AND valor_aberto > 0
    RETURNING 1
  )
  SELECT count(*) INTO v_updated_parcial FROM updated;

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

  -- Vencido -> Pendente (data_vencimento ainda não passou)
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
    'to_pago', v_updated_pago,
    'to_parcial', v_updated_parcial,
    'executed_at', NOW()
  );
END;
$$;