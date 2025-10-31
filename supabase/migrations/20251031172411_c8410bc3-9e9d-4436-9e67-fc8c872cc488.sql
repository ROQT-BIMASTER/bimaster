-- Desabilitar trigger para aplicar correções
ALTER TABLE photos DISABLE TRIGGER after_photo_upload;

-- 1. Corrigir função register_user_points para aceitar TEXT e fazer conversão interna
DROP FUNCTION IF EXISTS public.register_user_points(uuid, character varying, character varying, uuid, jsonb);
DROP FUNCTION IF EXISTS public.register_user_points(uuid, text, text, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.register_user_points(
  p_user_id uuid, 
  p_action_code text,  -- Mudado de varchar para text
  p_entity_type text DEFAULT NULL,  -- Mudado de varchar para text
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
  WHERE action_code = LEFT(p_action_code, 50) AND is_active = true;
  
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
  
  -- Registrar no histórico com conversão e truncagem explícita
  INSERT INTO user_points_history (
    user_id, action_code, base_points, multiplier, final_points,
    metadata, entity_type, entity_id, period_month
  ) VALUES (
    p_user_id, 
    LEFT(p_action_code, 50)::varchar(50),  -- Truncar e converter
    v_base_points, 
    v_multiplier, 
    v_final_points,
    p_metadata, 
    LEFT(COALESCE(p_entity_type, ''), 50)::varchar(50),  -- Truncar e converter
    p_entity_id, 
    v_period_month
  );
  
  RETURN v_final_points;
EXCEPTION
  WHEN OTHERS THEN
    -- Se falhar, não bloquear a operação principal
    RAISE WARNING 'Erro ao registrar pontos: %', SQLERRM;
    RETURN 0;
END;
$$;

-- 2. Atualizar trigger_register_photo_points para garantir passagem de tipos text
CREATE OR REPLACE FUNCTION public.trigger_register_photo_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_action_code text := 'photo_upload';  -- Definido como text
  v_metadata JSONB;
BEGIN
  v_metadata := jsonb_build_object(
    'photo_id', NEW.id,
    'store_id', NEW.store_id,
    'visit_id', NEW.visit_id,
    'photo_type', NEW.photo_type,
    'quality_score', NEW.quality_score
  );
  
  -- Registrar pontos com tipos text explícitos
  PERFORM register_user_points(
    NEW.vendedor_id,
    v_action_code::text,
    'photo'::text,
    NEW.id,
    v_metadata
  );
  
  RETURN NEW;
END;
$$;

-- 3. Reabilitar o trigger
ALTER TABLE photos ENABLE TRIGGER after_photo_upload;