-- Desabilitar trigger novamente
ALTER TABLE photos DISABLE TRIGGER after_photo_upload;

-- Corrigir a função register_user_points
DROP FUNCTION IF EXISTS public.register_user_points(uuid, character varying, character varying, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.register_user_points(
  p_user_id uuid, 
  p_action_code varchar, 
  p_entity_type varchar DEFAULT NULL, 
  p_entity_id uuid DEFAULT NULL, 
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    p_user_id, p_action_code::varchar(50), v_base_points, v_multiplier, v_final_points,
    p_metadata, p_entity_type::varchar(50), p_entity_id, v_period_month
  );
  
  RETURN v_final_points;
EXCEPTION
  WHEN OTHERS THEN
    -- Se falhar, não bloquear a operação principal
    RAISE WARNING 'Erro ao registrar pontos: %', SQLERRM;
    RETURN 0;
END;
$$;

-- Reabilitar o trigger
ALTER TABLE photos ENABLE TRIGGER after_photo_upload;