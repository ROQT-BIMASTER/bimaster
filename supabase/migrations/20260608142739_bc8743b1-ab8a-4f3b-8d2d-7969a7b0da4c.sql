
-- Prevent privilege escalation via self-update on profiles
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  -- service_role bypasses
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins can change anything
  is_admin_user := public.has_role(auth.uid(), 'admin'::app_role);
  IF is_admin_user THEN
    RETURN NEW;
  END IF;

  -- For self-updates (or any non-admin update), preserve sensitive fields
  IF NEW.aprovado IS DISTINCT FROM OLD.aprovado THEN
    NEW.aprovado := OLD.aprovado;
  END IF;
  IF NEW.departamento_id IS DISTINCT FROM OLD.departamento_id THEN
    NEW.departamento_id := OLD.departamento_id;
  END IF;
  IF NEW.supervisor_id IS DISTINCT FROM OLD.supervisor_id THEN
    NEW.supervisor_id := OLD.supervisor_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();
