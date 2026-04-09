
-- 1. Seed security_audit_log from access_audit_log
INSERT INTO security_audit_log (action, severity, user_id, metadata, created_at)
SELECT
  CASE
    WHEN a.action = 'login_failed' THEN 'login_failed'
    WHEN a.action = 'access_denied' THEN 'access_denied'
    WHEN a.action = 'login' AND a.success = true THEN 'login_success'
    ELSE a.action
  END,
  CASE
    WHEN a.action = 'login_failed' THEN 'high'
    WHEN a.action = 'access_denied' THEN 'medium'
    WHEN a.action = 'login' AND a.success = true THEN 'low'
    ELSE 'low'
  END,
  a.user_id,
  jsonb_build_object(
    'source', 'seed_from_access_audit_log',
    'original_action', a.action,
    'success', a.success,
    'ip_address', a.ip_address::text,
    'user_agent', a.user_agent,
    'modulo', a.modulo_codigo,
    'tela', a.tela_codigo
  ),
  a.created_at
FROM access_audit_log a
WHERE a.action IN ('login_failed', 'access_denied', 'login')
  AND a.created_at IS NOT NULL;

-- 2. Detect brute-force clusters and create security_incidents
INSERT INTO security_incidents (incident_type, severity, title, description, status, confidence_score, detection_method, auto_action_taken, created_at)
SELECT
  'brute_force',
  'critical',
  'Cluster de login falhado detectado',
  'Usuário ' || COALESCE(user_id::text, 'desconhecido') || ' teve ' || cnt || ' tentativas falhadas em 1 hora (janela: ' || hora || ')',
  'open',
  0.85,
  'pattern_analysis',
  'none',
  hora
FROM (
  SELECT
    user_id,
    date_trunc('hour', created_at) AS hora,
    count(*) AS cnt
  FROM access_audit_log
  WHERE action = 'login_failed'
    AND created_at IS NOT NULL
  GROUP BY user_id, date_trunc('hour', created_at)
  HAVING count(*) >= 5
) clusters;

-- 3. Create trigger function to auto-populate security_audit_log
CREATE OR REPLACE FUNCTION public.fn_access_to_security_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.action IN ('login_failed', 'access_denied') THEN
    INSERT INTO security_audit_log (action, severity, user_id, metadata, created_at)
    VALUES (
      NEW.action,
      CASE WHEN NEW.action = 'login_failed' THEN 'high' ELSE 'medium' END,
      NEW.user_id,
      jsonb_build_object(
        'source', 'auto_trigger',
        'ip_address', NEW.ip_address::text,
        'user_agent', NEW.user_agent,
        'modulo', NEW.modulo_codigo,
        'tela', NEW.tela_codigo
      ),
      COALESCE(NEW.created_at, now())
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Create trigger on access_audit_log
DROP TRIGGER IF EXISTS trg_access_to_security_audit ON access_audit_log;
CREATE TRIGGER trg_access_to_security_audit
  AFTER INSERT ON access_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_access_to_security_audit();

-- 5. Enable realtime for security_audit_log
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_audit_log;
