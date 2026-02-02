
-- Fix function search_path for calcular_status_financeiro
CREATE OR REPLACE FUNCTION public.calcular_status_financeiro(
  p_data_vencimento date,
  p_data_pagamento date,
  p_valor_pago numeric,
  p_valor_original numeric
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  -- Se foi pago
  IF p_valor_pago IS NOT NULL AND p_valor_pago > 0 THEN
    IF p_valor_pago >= p_valor_original THEN
      IF p_data_pagamento IS NOT NULL AND p_data_pagamento <= p_data_vencimento THEN
        v_status := 'pago_em_dia';
      ELSE
        v_status := 'pago_com_atraso';
      END IF;
    ELSE
      v_status := 'pago_parcial';
    END IF;
  -- Não foi pago
  ELSE
    IF p_data_vencimento < CURRENT_DATE THEN
      v_status := 'vencido';
    ELSIF p_data_vencimento = CURRENT_DATE THEN
      v_status := 'vence_hoje';
    ELSIF p_data_vencimento <= CURRENT_DATE + INTERVAL '7 days' THEN
      v_status := 'a_vencer_7_dias';
    ELSIF p_data_vencimento <= CURRENT_DATE + INTERVAL '30 days' THEN
      v_status := 'a_vencer_30_dias';
    ELSE
      v_status := 'a_vencer';
    END IF;
  END IF;
  
  RETURN v_status;
END;
$$;
