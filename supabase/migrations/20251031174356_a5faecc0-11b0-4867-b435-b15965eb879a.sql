-- Função para registrar pontos automaticamente
CREATE OR REPLACE FUNCTION register_action_points(
  p_user_id UUID,
  p_action_code VARCHAR,
  p_entity_type VARCHAR DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action_config RECORD;
  v_base_points INTEGER;
  v_multiplier NUMERIC := 1.0;
  v_final_points INTEGER;
BEGIN
  -- Buscar configuração da ação
  SELECT * INTO v_action_config
  FROM trade_action_points
  WHERE action_code = p_action_code AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN; -- Ação não encontrada ou inativa
  END IF;
  
  v_base_points := v_action_config.base_points;
  
  -- Aplicar multiplicadores (pode ser expandido)
  -- Por enquanto, usar multiplicador fixo 1.0
  
  v_final_points := (v_base_points * v_multiplier)::INTEGER;
  
  -- Registrar pontos
  INSERT INTO user_points_history (
    user_id,
    action_code,
    base_points,
    multiplier,
    final_points,
    metadata,
    entity_type,
    entity_id,
    earned_at,
    period_month
  ) VALUES (
    p_user_id,
    p_action_code,
    v_base_points,
    v_multiplier,
    v_final_points,
    p_metadata,
    p_entity_type,
    p_entity_id,
    NOW(),
    TO_CHAR(NOW(), 'YYYY-MM')
  );
  
END;
$$;

-- Trigger para lançamentos financeiros aprovados
CREATE OR REPLACE FUNCTION trigger_financial_entry_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Registrar pontos quando um lançamento é aprovado
  IF NEW.approval_status = 'approved' AND (OLD.approval_status IS NULL OR OLD.approval_status != 'approved') THEN
    PERFORM register_action_points(
      NEW.created_by,
      'sellout_entry',
      'financial_entry',
      NEW.id,
      jsonb_build_object(
        'amount', NEW.amount,
        'entry_type', NEW.entry_type,
        'store_id', NEW.store_id
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS financial_entry_points_trigger ON trade_financial_entries;
CREATE TRIGGER financial_entry_points_trigger
  AFTER INSERT OR UPDATE OF approval_status
  ON trade_financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION trigger_financial_entry_points();

-- Trigger para visitas completadas
CREATE OR REPLACE FUNCTION trigger_visit_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Registrar pontos quando visita é completada
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    PERFORM register_action_points(
      NEW.user_id,
      'visit_complete',
      'visit',
      NEW.id,
      jsonb_build_object(
        'store_id', NEW.store_id,
        'visit_date', NEW.visit_date
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visit_points_trigger ON visits;
CREATE TRIGGER visit_points_trigger
  AFTER INSERT OR UPDATE OF status
  ON visits
  FOR EACH ROW
  EXECUTE FUNCTION trigger_visit_points();

-- Trigger para fotos aprovadas
CREATE OR REPLACE FUNCTION trigger_photo_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Registrar pontos quando foto é aprovada
  IF NEW.approved = true AND (OLD.approved IS NULL OR OLD.approved = false) AND NEW.vendedor_id IS NOT NULL THEN
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
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS photo_points_trigger ON photos;
CREATE TRIGGER photo_points_trigger
  AFTER INSERT OR UPDATE OF approved
  ON photos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_photo_points();

-- Trigger para medições de gôndola
CREATE OR REPLACE FUNCTION trigger_shelf_measurement_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Registrar pontos quando medição é criada
  IF TG_OP = 'INSERT' AND NEW.vendedor_id IS NOT NULL THEN
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
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shelf_measurement_points_trigger ON shelf_measurements;
CREATE TRIGGER shelf_measurement_points_trigger
  AFTER INSERT
  ON shelf_measurements
  FOR EACH ROW
  EXECUTE FUNCTION trigger_shelf_measurement_points();

-- Trigger para auditorias de gôndola
CREATE OR REPLACE FUNCTION trigger_audit_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Registrar pontos quando auditoria é criada
  IF TG_OP = 'INSERT' AND NEW.vendedor_id IS NOT NULL THEN
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
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_points_trigger ON gondola_audits;
CREATE TRIGGER audit_points_trigger
  AFTER INSERT
  ON gondola_audits
  FOR EACH ROW
  EXECUTE FUNCTION trigger_audit_points();

-- Comentário de documentação
COMMENT ON FUNCTION register_action_points IS 'Registra pontos automaticamente para ações do usuário';
COMMENT ON FUNCTION trigger_financial_entry_points IS 'Trigger para registrar pontos de lançamentos financeiros aprovados';
COMMENT ON FUNCTION trigger_visit_points IS 'Trigger para registrar pontos de visitas completadas';
COMMENT ON FUNCTION trigger_photo_points IS 'Trigger para registrar pontos de fotos aprovadas';
COMMENT ON FUNCTION trigger_shelf_measurement_points IS 'Trigger para registrar pontos de medições de gôndola';
COMMENT ON FUNCTION trigger_audit_points IS 'Trigger para registrar pontos de auditorias';