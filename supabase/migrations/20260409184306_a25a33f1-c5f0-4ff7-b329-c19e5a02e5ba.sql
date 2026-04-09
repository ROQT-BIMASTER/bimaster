
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
      CASE WHEN NEW.action = 'login_failed' THEN 'error' ELSE 'warn' END,
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
