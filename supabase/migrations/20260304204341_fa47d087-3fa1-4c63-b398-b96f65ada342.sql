
-- Fix log_campaign_changes function to use correct search_path
CREATE OR REPLACE FUNCTION public.log_campaign_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  SELECT nome INTO v_user_name FROM public.profiles WHERE id = auth.uid();
  
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.trade_campaign_audit_log (campaign_id, action, field_changed, old_value, new_value, user_id, user_name)
      VALUES (NEW.id, 'status_changed', 'status', OLD.status, NEW.status, auth.uid(), v_user_name);
    END IF;
    
    IF OLD.validation_status IS DISTINCT FROM NEW.validation_status THEN
      INSERT INTO public.trade_campaign_audit_log (campaign_id, action, field_changed, old_value, new_value, user_id, user_name)
      VALUES (NEW.id, 'validation_changed', 'validation_status', OLD.validation_status, NEW.validation_status, auth.uid(), v_user_name);
    END IF;
    
    IF OLD.verba_orcada IS DISTINCT FROM NEW.verba_orcada THEN
      INSERT INTO public.trade_campaign_audit_log (campaign_id, action, field_changed, old_value, new_value, user_id, user_name)
      VALUES (NEW.id, 'budget_changed', 'verba_orcada', OLD.verba_orcada::TEXT, NEW.verba_orcada::TEXT, auth.uid(), v_user_name);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
