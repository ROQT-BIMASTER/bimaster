-- Remover completamente os triggers v2 se existirem
DROP TRIGGER IF EXISTS financial_entry_points_v2_trigger ON trade_financial_entries CASCADE;
DROP TRIGGER IF EXISTS visit_points_v2_trigger ON visits CASCADE;
DROP TRIGGER IF EXISTS photo_points_v2_trigger ON photos CASCADE;
DROP TRIGGER IF EXISTS shelf_measurement_points_v2_trigger ON shelf_measurements CASCADE;
DROP TRIGGER IF EXISTS audit_points_v2_trigger ON gondola_audits CASCADE;

-- Remover as funções v2
DROP FUNCTION IF EXISTS trigger_financial_entry_points_v2() CASCADE;
DROP FUNCTION IF EXISTS trigger_visit_points_v2() CASCADE;
DROP FUNCTION IF EXISTS trigger_photo_points_v2() CASCADE;
DROP FUNCTION IF EXISTS trigger_shelf_measurement_points_v2() CASCADE;
DROP FUNCTION IF EXISTS trigger_audit_points_v2() CASCADE;