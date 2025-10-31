-- Atualizar função de cálculo de pontos removendo GPS check-in
CREATE OR REPLACE FUNCTION public.calculate_visit_points(visit_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_points INTEGER := 50;
  v_multiplier NUMERIC := 1.0;
  v_visit RECORD;
  v_photos_count INTEGER;
  v_has_observations BOOLEAN;
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
  
  -- Duração registrada: +15%
  IF v_has_duration THEN
    v_multiplier := v_multiplier + 0.15;
  END IF;
  
  -- Checklist completo: +20%
  IF v_visit.checklist_completed THEN
    v_multiplier := v_multiplier + 0.20;
  END IF;
  
  -- Bônus de compliance (se > 80%)
  IF v_visit.compliance_score IS NOT NULL AND v_visit.compliance_score >= 80 THEN
    v_compliance_bonus := (v_visit.compliance_score - 80) * 0.01; -- 1% extra por ponto acima de 80
    v_multiplier := v_multiplier + v_compliance_bonus;
  END IF;
  
  -- Calcular pontos finais
  RETURN FLOOR(v_base_points * v_multiplier);
END;
$function$;