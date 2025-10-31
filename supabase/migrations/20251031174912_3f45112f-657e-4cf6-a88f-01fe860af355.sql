-- Corrigir trigger de lançamentos financeiros
DROP TRIGGER IF EXISTS financial_entry_points_trigger ON trade_financial_entries;

CREATE OR REPLACE FUNCTION trigger_financial_entry_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Registrar pontos quando um lançamento é aprovado
  IF NEW.approval_status = 'approved' AND (OLD IS NULL OR OLD.approval_status IS NULL OR OLD.approval_status != 'approved') THEN
    PERFORM register_action_points(
      NEW.created_by,
      'sellout_entry',
      'financial_entry',
      NEW.id,
      jsonb_build_object(
        'amount', NEW.amount,
        'entry_type', NEW.entry_type,
        'store_id', NEW.store_id,
        'entry_date', NEW.entry_date
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER financial_entry_points_trigger
  AFTER INSERT OR UPDATE OF approval_status
  ON trade_financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_financial_entry_points();

-- Corrigir trigger de visitas também
DROP TRIGGER IF EXISTS visit_points_trigger ON visits;

CREATE OR REPLACE FUNCTION trigger_visit_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Registrar pontos quando visita é completada
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM register_action_points(
      NEW.user_id,
      'visit_complete',
      'visit',
      NEW.id,
      jsonb_build_object(
        'store_id', NEW.store_id,
        'visit_date', COALESCE(NEW.visit_date, NEW.created_at)
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER visit_points_trigger
  AFTER INSERT OR UPDATE OF status
  ON visits
  FOR EACH ROW
  EXECUTE FUNCTION trigger_visit_points();