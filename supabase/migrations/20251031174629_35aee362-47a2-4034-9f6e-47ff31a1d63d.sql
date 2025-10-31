-- Corrigir search_path das funções para segurança
ALTER FUNCTION register_action_points(UUID, VARCHAR, VARCHAR, UUID, JSONB) SET search_path = public;
ALTER FUNCTION trigger_financial_entry_points() SET search_path = public;
ALTER FUNCTION trigger_visit_points() SET search_path = public;
ALTER FUNCTION trigger_photo_points() SET search_path = public;
ALTER FUNCTION trigger_shelf_measurement_points() SET search_path = public;
ALTER FUNCTION trigger_audit_points() SET search_path = public;