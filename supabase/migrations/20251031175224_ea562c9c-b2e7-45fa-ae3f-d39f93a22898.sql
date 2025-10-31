-- Remover TODOS os triggers antigos que podem estar causando conflito
DROP TRIGGER IF EXISTS financial_entry_points_trigger ON trade_financial_entries CASCADE;
DROP TRIGGER IF EXISTS visit_points_trigger ON visits CASCADE;
DROP TRIGGER IF EXISTS photo_points_trigger ON photos CASCADE;
DROP TRIGGER IF EXISTS shelf_measurement_points_trigger ON shelf_measurements CASCADE;
DROP TRIGGER IF EXISTS audit_points_trigger ON gondola_audits CASCADE;
DROP TRIGGER IF EXISTS register_visit_points ON visits CASCADE;
DROP TRIGGER IF EXISTS register_audit_points ON gondola_audits CASCADE;
DROP TRIGGER IF EXISTS register_photo_points ON photos CASCADE;
DROP TRIGGER IF EXISTS register_shelf_measurement_points ON shelf_measurements CASCADE;

-- Remover funções antigas também
DROP FUNCTION IF EXISTS trigger_register_visit_points() CASCADE;
DROP FUNCTION IF EXISTS trigger_register_audit_points() CASCADE;
DROP FUNCTION IF EXISTS trigger_register_photo_points() CASCADE;
DROP FUNCTION IF EXISTS trigger_register_shelf_measurement_points() CASCADE;
DROP FUNCTION IF EXISTS trigger_register_sellout_points() CASCADE;

-- Criar versão simples e segura dos triggers SEM verificação de visit_date

-- 1. Trigger para lançamentos financeiros (SEM CAMPO VISIT_DATE)
CREATE OR REPLACE FUNCTION trigger_financial_entry_points_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas registrar pontos quando aprovado
  IF NEW.approval_status = 'approved' 
     AND (OLD IS NULL OR OLD.approval_status != 'approved') 
     AND NEW.created_by IS NOT NULL THEN
    
    BEGIN
      PERFORM register_action_points(
        NEW.created_by,
        'sellout_entry',
        'financial_entry',
        NEW.id,
        jsonb_build_object(
          'amount', NEW.amount,
          'entry_type', NEW.entry_type,
          'entry_date', NEW.entry_date
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log erro mas não bloquear operação
      RAISE WARNING 'Erro ao registrar pontos: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER financial_entry_points_v2_trigger
  AFTER INSERT OR UPDATE OF approval_status
  ON trade_financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_financial_entry_points_v2();

-- 2. Trigger para visitas completadas
CREATE OR REPLACE FUNCTION trigger_visit_points_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' 
     AND (OLD IS NULL OR OLD.status != 'completed')
     AND NEW.user_id IS NOT NULL THEN
    
    BEGIN
      PERFORM register_action_points(
        NEW.user_id,
        'visit_complete',
        'visit',
        NEW.id,
        jsonb_build_object(
          'store_id', NEW.store_id,
          'created_at', NEW.created_at
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar pontos visita: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER visit_points_v2_trigger
  AFTER INSERT OR UPDATE OF status
  ON visits
  FOR EACH ROW
  EXECUTE FUNCTION trigger_visit_points_v2();

-- 3. Trigger para fotos
CREATE OR REPLACE FUNCTION trigger_photo_points_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approved = true 
     AND (OLD IS NULL OR OLD.approved = false) 
     AND NEW.vendedor_id IS NOT NULL THEN
    
    BEGIN
      PERFORM register_action_points(
        NEW.vendedor_id,
        'photo_upload',
        'photo',
        NEW.id,
        jsonb_build_object(
          'store_id', NEW.store_id,
          'visit_id', NEW.visit_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar pontos foto: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER photo_points_v2_trigger
  AFTER INSERT OR UPDATE OF approved
  ON photos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_photo_points_v2();

-- 4. Trigger para medições
CREATE OR REPLACE FUNCTION trigger_shelf_measurement_points_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.vendedor_id IS NOT NULL THEN
    BEGIN
      PERFORM register_action_points(
        NEW.vendedor_id,
        'shelf_measurement',
        'shelf_measurement',
        NEW.id,
        jsonb_build_object(
          'store_id', NEW.store_id,
          'shelf_share_percentage', NEW.shelf_share_percentage
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar pontos medição: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER shelf_measurement_points_v2_trigger
  AFTER INSERT
  ON shelf_measurements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_shelf_measurement_points_v2();

-- 5. Trigger para auditorias
CREATE OR REPLACE FUNCTION trigger_audit_points_v2()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.vendedor_id IS NOT NULL THEN
    BEGIN
      PERFORM register_action_points(
        NEW.vendedor_id,
        'audit_complete',
        'gondola_audit',
        NEW.id,
        jsonb_build_object(
          'store_id', NEW.store_id,
          'compliance_score', NEW.overall_compliance_score
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao registrar pontos auditoria: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_points_v2_trigger
  AFTER INSERT
  ON gondola_audits
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_points_v2();