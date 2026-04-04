
-- CORREÇÃO 5: search_path nas 4 functions
ALTER FUNCTION enqueue_email SET search_path = public;
ALTER FUNCTION delete_email SET search_path = public;
ALTER FUNCTION read_email_batch SET search_path = public;
ALTER FUNCTION move_to_dlq SET search_path = public;

-- CORREÇÃO 6: security_audit_log INSERT
DROP POLICY IF EXISTS "System can insert security logs" ON security_audit_log;

CREATE POLICY "Authenticated or service can insert security logs"
  ON security_audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL OR auth.role() = 'service_role');
