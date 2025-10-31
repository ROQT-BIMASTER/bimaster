-- Recriar apenas o trigger de lançamentos financeiros de forma super simples
CREATE OR REPLACE FUNCTION points_on_financial_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Registrar pontos quando aprovado
  IF NEW.approval_status = 'approved' 
     AND (OLD IS NULL OR OLD.approval_status != 'approved') 
     AND NEW.created_by IS NOT NULL THEN
    
    PERFORM register_action_points(
      NEW.created_by,
      'sellout_entry',
      'financial_entry',
      NEW.id,
      jsonb_build_object('amount', NEW.amount)
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Não bloquear a operação se falhar registro de pontos
  RETURN NEW;
END;
$$;

CREATE TRIGGER points_financial_entry
  AFTER INSERT OR UPDATE OF approval_status
  ON trade_financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION points_on_financial_approval();