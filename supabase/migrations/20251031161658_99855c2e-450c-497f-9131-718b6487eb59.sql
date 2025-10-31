-- ============================================
-- SISTEMA DE PONTUAÇÃO COMPLETA PARA VISITAS
-- ============================================

-- Função para calcular pontos de visita baseado na completude
CREATE OR REPLACE FUNCTION calculate_visit_points(visit_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_base_points INTEGER := 50;
  v_multiplier NUMERIC := 1.0;
  v_visit RECORD;
  v_photos_count INTEGER;
  v_has_observations BOOLEAN;
  v_has_checkin BOOLEAN;
  v_has_duration BOOLEAN;
  v_compliance_bonus NUMERIC := 0;
BEGIN
  -- Buscar dados da visita
  SELECT * INTO v_visit FROM visits WHERE id = visit_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Contar fotos da visita
  SELECT COUNT(*) INTO v_photos_count
  FROM photos
  WHERE visit_id = visit_id;
  
  -- Verificar se tem observações
  v_has_observations := v_visit.notes IS NOT NULL AND LENGTH(TRIM(v_visit.notes)) > 0;
  
  -- Verificar se fez check-in
  v_has_checkin := v_visit.check_in_time IS NOT NULL;
  
  -- Verificar se registrou duração
  v_has_duration := v_visit.duration_minutes IS NOT NULL AND v_visit.duration_minutes > 0;
  
  -- Calcular multiplicador baseado na completude
  -- Cada item completo adiciona ao multiplicador
  
  -- Fotos: +20% se tiver pelo menos 1 foto, +40% se tiver 3 ou mais
  IF v_photos_count >= 3 THEN
    v_multiplier := v_multiplier + 0.4;
  ELSIF v_photos_count >= 1 THEN
    v_multiplier := v_multiplier + 0.2;
  END IF;
  
  -- Observações: +15%
  IF v_has_observations THEN
    v_multiplier := v_multiplier + 0.15;
  END IF;
  
  -- Check-in com localização: +10%
  IF v_has_checkin AND v_visit.check_in_latitude IS NOT NULL THEN
    v_multiplier := v_multiplier + 0.10;
  END IF;
  
  -- Duração registrada: +10%
  IF v_has_duration THEN
    v_multiplier := v_multiplier + 0.10;
  END IF;
  
  -- Checklist completo: +15%
  IF v_visit.checklist_completed THEN
    v_multiplier := v_multiplier + 0.15;
  END IF;
  
  -- Bônus de compliance (se > 80%)
  IF v_visit.compliance_score IS NOT NULL AND v_visit.compliance_score >= 80 THEN
    v_compliance_bonus := (v_visit.compliance_score - 80) * 0.01; -- 1% extra por ponto acima de 80
    v_multiplier := v_multiplier + v_compliance_bonus;
  END IF;
  
  -- Calcular pontos finais
  RETURN FLOOR(v_base_points * v_multiplier);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para registrar pontos automaticamente quando visita é completada
CREATE OR REPLACE FUNCTION trigger_register_visit_points()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER;
  v_action_code VARCHAR := 'visit_complete';
  v_metadata JSONB;
BEGIN
  -- Só registrar pontos quando visita é marcada como completada
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Calcular pontos da visita
    v_points := calculate_visit_points(NEW.id);
    
    -- Preparar metadata
    v_metadata := jsonb_build_object(
      'visit_id', NEW.id,
      'store_id', NEW.store_id,
      'compliance_score', NEW.compliance_score,
      'photos_count', (SELECT COUNT(*) FROM photos WHERE visit_id = NEW.id),
      'has_notes', NEW.notes IS NOT NULL AND LENGTH(TRIM(NEW.notes)) > 0,
      'checklist_completed', NEW.checklist_completed,
      'has_duration', NEW.duration_minutes IS NOT NULL
    );
    
    -- Registrar pontos usando a função já existente
    PERFORM register_user_points(
      NEW.user_id,
      v_action_code,
      'visit',
      NEW.id,
      v_metadata
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para visitas
DROP TRIGGER IF EXISTS after_visit_complete ON visits;
CREATE TRIGGER after_visit_complete
AFTER UPDATE ON visits
FOR EACH ROW
EXECUTE FUNCTION trigger_register_visit_points();

-- Trigger para registrar pontos ao fazer upload de foto
CREATE OR REPLACE FUNCTION trigger_register_photo_points()
RETURNS TRIGGER AS $$
DECLARE
  v_action_code VARCHAR := 'photo_upload';
  v_metadata JSONB;
BEGIN
  v_metadata := jsonb_build_object(
    'photo_id', NEW.id,
    'store_id', NEW.store_id,
    'visit_id', NEW.visit_id,
    'photo_type', NEW.photo_type,
    'quality_score', NEW.quality_score
  );
  
  -- Registrar pontos (30 pontos base por foto)
  PERFORM register_user_points(
    NEW.vendedor_id,
    v_action_code,
    'photo',
    NEW.id,
    v_metadata
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS after_photo_upload ON photos;
CREATE TRIGGER after_photo_upload
AFTER INSERT ON photos
FOR EACH ROW
EXECUTE FUNCTION trigger_register_photo_points();

-- Trigger para registrar pontos de auditoria completa
CREATE OR REPLACE FUNCTION trigger_register_audit_points()
RETURNS TRIGGER AS $$
DECLARE
  v_action_code VARCHAR := 'audit_complete';
  v_metadata JSONB;
  v_multiplier NUMERIC := 1.0;
BEGIN
  -- Só registrar quando auditoria for aprovada
  IF NEW.approved = true AND (OLD.approved IS NULL OR OLD.approved = false) THEN
    
    -- Multiplicador baseado em compliance
    IF NEW.compliance_score >= 95 THEN
      v_multiplier := 2.0; -- Dobro dos pontos para auditoria perfeita
    ELSIF NEW.compliance_score >= 85 THEN
      v_multiplier := 1.5;
    END IF;
    
    v_metadata := jsonb_build_object(
      'audit_id', NEW.id,
      'store_id', NEW.store_id,
      'compliance_score', NEW.compliance_score,
      'multiplier', v_multiplier
    );
    
    -- Registrar pontos (100 pontos base)
    PERFORM register_user_points(
      NEW.vendedor_id,
      v_action_code,
      'audit',
      NEW.id,
      v_metadata
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS after_audit_approval ON gondola_audits;
CREATE TRIGGER after_audit_approval
AFTER UPDATE ON gondola_audits
FOR EACH ROW
EXECUTE FUNCTION trigger_register_audit_points();

-- Trigger para medição de gôndola
CREATE OR REPLACE FUNCTION trigger_register_shelf_measurement_points()
RETURNS TRIGGER AS $$
DECLARE
  v_action_code VARCHAR := 'shelf_measurement';
  v_metadata JSONB;
BEGIN
  v_metadata := jsonb_build_object(
    'measurement_id', NEW.id,
    'store_id', NEW.store_id,
    'shelf_share_percentage', NEW.shelf_share_percentage
  );
  
  PERFORM register_user_points(
    NEW.vendedor_id,
    v_action_code,
    'shelf_measurement',
    NEW.id,
    v_metadata
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS after_shelf_measurement ON shelf_measurements;
CREATE TRIGGER after_shelf_measurement
AFTER INSERT ON shelf_measurements
FOR EACH ROW
EXECUTE FUNCTION trigger_register_shelf_measurement_points();

-- Trigger para sell out
CREATE OR REPLACE FUNCTION trigger_register_sellout_points()
RETURNS TRIGGER AS $$
DECLARE
  v_action_code VARCHAR := 'sellout_entry';
  v_metadata JSONB;
  v_user_id UUID;
BEGIN
  -- Buscar vendedor responsável pela loja
  SELECT created_by INTO v_user_id
  FROM stores
  WHERE id = NEW.store_id;
  
  IF v_user_id IS NOT NULL THEN
    v_metadata := jsonb_build_object(
      'sellout_id', NEW.id,
      'store_id', NEW.store_id,
      'quantity', NEW.quantity
    );
    
    PERFORM register_user_points(
      v_user_id,
      v_action_code,
      'sellout',
      NEW.id,
      v_metadata
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS after_sellout_entry ON store_sellout_items;
CREATE TRIGGER after_sellout_entry
AFTER INSERT ON store_sellout_items
FOR EACH ROW
EXECUTE FUNCTION trigger_register_sellout_points();

-- Atualizar a função register_user_points para usar multiplicador do metadata
CREATE OR REPLACE FUNCTION register_user_points(
  p_user_id UUID,
  p_action_code VARCHAR,
  p_entity_type VARCHAR DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS INTEGER AS $$
DECLARE
  v_base_points INTEGER;
  v_multiplier NUMERIC := 1.0;
  v_final_points INTEGER;
  v_period_month VARCHAR(7);
  v_metadata_multiplier NUMERIC;
BEGIN
  -- Buscar pontos base da ação
  SELECT base_points INTO v_base_points
  FROM trade_action_points
  WHERE action_code = p_action_code AND is_active = true;
  
  IF v_base_points IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Verificar se metadata tem multiplicador customizado
  v_metadata_multiplier := (p_metadata->>'multiplier')::NUMERIC;
  IF v_metadata_multiplier IS NOT NULL AND v_metadata_multiplier > 1.0 THEN
    v_multiplier := v_metadata_multiplier;
  END IF;
  
  v_period_month := to_char(CURRENT_DATE, 'YYYY-MM');
  v_final_points := FLOOR(v_base_points * v_multiplier);
  
  -- Registrar no histórico
  INSERT INTO user_points_history (
    user_id, action_code, base_points, multiplier, final_points,
    metadata, entity_type, entity_id, period_month
  ) VALUES (
    p_user_id, p_action_code, v_base_points, v_multiplier, v_final_points,
    p_metadata, p_entity_type, p_entity_id, v_period_month
  );
  
  RETURN v_final_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;