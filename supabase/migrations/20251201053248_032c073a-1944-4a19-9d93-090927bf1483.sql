-- Corrigir search_path da função calcular_status_conta_pagar
CREATE OR REPLACE FUNCTION calcular_status_conta_pagar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.status := CASE 
    WHEN NEW.valor_aberto = 0 OR NEW.valor_aberto IS NULL THEN 'pago'
    WHEN NEW.valor_pago > 0 AND NEW.valor_aberto > 0 THEN 'parcial'
    WHEN NEW.data_vencimento < CURRENT_DATE AND NEW.valor_aberto > 0 THEN 'vencido'
    ELSE 'pendente'
  END;
  RETURN NEW;
END;
$$;