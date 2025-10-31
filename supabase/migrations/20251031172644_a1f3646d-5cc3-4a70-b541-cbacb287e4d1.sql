-- Corrigir função update_user_ranking com search_path
CREATE OR REPLACE FUNCTION public.update_user_ranking(p_user_id uuid, p_period_type character varying, p_period_key character varying)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'  -- Adicionar search_path
AS $$
DECLARE
  v_total_points INTEGER;
  v_level_info RECORD;
BEGIN
  SELECT COALESCE(SUM(final_points), 0) INTO v_total_points
  FROM user_points_history
  WHERE user_id = p_user_id
    AND (
      (p_period_type = 'monthly' AND period_month = p_period_key) OR
      (p_period_type = 'quarterly' AND LEFT(period_month, 4) || '-Q' || CEILING(CAST(RIGHT(period_month, 2) AS INTEGER) / 3.0) = p_period_key) OR
      (p_period_type = 'yearly' AND LEFT(period_month, 4) = p_period_key) OR
      (p_period_type = 'all_time')
    );
  
  SELECT * INTO v_level_info FROM calculate_user_level(v_total_points);
  
  INSERT INTO user_rankings (user_id, period_type, period_key, total_points, level_number, level_name, updated_at)
  VALUES (p_user_id, p_period_type, p_period_key, v_total_points, v_level_info.level_number, v_level_info.level_name, now())
  ON CONFLICT (user_id, period_type, period_key)
  DO UPDATE SET
    total_points = v_total_points,
    level_number = v_level_info.level_number,
    level_name = v_level_info.level_name,
    updated_at = now();
    
  WITH ranked_users AS (
    SELECT 
      user_id,
      ROW_NUMBER() OVER (ORDER BY total_points DESC) as position
    FROM user_rankings
    WHERE period_type = p_period_type AND period_key = p_period_key
  )
  UPDATE user_rankings ur
  SET ranking_position = ru.position
  FROM ranked_users ru
  WHERE ur.user_id = ru.user_id
    AND ur.period_type = p_period_type
    AND ur.period_key = p_period_key;
END;
$$;