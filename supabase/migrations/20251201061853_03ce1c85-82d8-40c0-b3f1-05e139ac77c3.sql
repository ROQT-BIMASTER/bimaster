
-- Fix remaining security definer functions with incorrect or missing search_path

-- Fix update_updated_at_column (missing search_path)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Fix update_budget_reserved_amount (empty search_path)
CREATE OR REPLACE FUNCTION public.update_budget_reserved_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE public.trade_budgets
    SET reserved_amount = COALESCE(reserved_amount, 0) + NEW.reserved_amount
    WHERE id = NEW.budget_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'active' AND NEW.status IN ('released', 'consumed') THEN
    UPDATE public.trade_budgets
    SET reserved_amount = COALESCE(reserved_amount, 0) - OLD.reserved_amount
    WHERE id = OLD.budget_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix log_changes (empty search_path)
CREATE OR REPLACE FUNCTION public.log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.etl_changelog (table_name, operation, record_id, changed_data, changed_by)
    VALUES (TG_TABLE_NAME, TG_OP, OLD.id, row_to_json(OLD), auth.uid());
    RETURN OLD;
  ELSE
    INSERT INTO public.etl_changelog (table_name, operation, record_id, changed_data, changed_by)
    VALUES (TG_TABLE_NAME, TG_OP, NEW.id, row_to_json(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$function$;

-- Fix sincronizar_permissoes_usuario (empty search_path)
CREATE OR REPLACE FUNCTION public.sincronizar_permissoes_usuario(p_user_id uuid)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role public.app_role;
BEGIN
  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_role = 'admin' THEN
    RETURN;
  END IF;

  DELETE FROM public.usuario_permissoes_telas
  WHERE usuario_id = p_user_id;

  INSERT INTO public.usuario_permissoes_telas (usuario_id, tela_id)
  SELECT p_user_id, tela_id
  FROM public.role_permissoes_telas
  WHERE role = v_role;
END;
$function$;

-- Fix validate_investment_date (empty search_path)
CREATE OR REPLACE FUNCTION public.validate_investment_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.investment_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data do investimento não pode ser futura';
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix validate_budget_period (empty search_path)
CREATE OR REPLACE FUNCTION public.validate_budget_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.period_end <= NEW.period_start THEN
    RAISE EXCEPTION 'Data de fim deve ser posterior à data de início';
  END IF;
  RETURN NEW;
END;
$function$;
