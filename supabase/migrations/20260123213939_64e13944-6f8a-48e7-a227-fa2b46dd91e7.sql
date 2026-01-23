-- Corrigir search_path nas funções criadas
CREATE OR REPLACE FUNCTION calculate_campaign_metrics()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.sell_out_anterior, 0) > 0 THEN
    NEW.crescimento_percentual := 
      ((COALESCE(NEW.sell_out_atual, 0) - NEW.sell_out_anterior) / NEW.sell_out_anterior) * 100;
  ELSE
    NEW.crescimento_percentual := NULL;
  END IF;
  
  IF COALESCE(NEW.actual_cost, 0) > 0 THEN
    NEW.roi_valor := (COALESCE(NEW.sell_out_atual, 0) - COALESCE(NEW.sell_out_anterior, 0)) - NEW.actual_cost;
    NEW.roi_percentual := (NEW.roi_valor / NEW.actual_cost) * 100;
  ELSE
    NEW.roi_valor := 0;
    NEW.roi_percentual := 0;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_campaign_sellout_totals()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE trade_campaigns
  SET 
    sell_in_anterior = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM trade_campaign_sellout_entries 
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
        AND entry_type = 'sell_in' 
        AND period = 'anterior'
        AND validation_status = 'approved'
    ),
    sell_in_atual = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM trade_campaign_sellout_entries 
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
        AND entry_type = 'sell_in' 
        AND period = 'atual'
        AND validation_status = 'approved'
    ),
    sell_out_anterior = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM trade_campaign_sellout_entries 
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
        AND entry_type = 'sell_out' 
        AND period = 'anterior'
        AND validation_status = 'approved'
    ),
    sell_out_atual = (
      SELECT COALESCE(SUM(amount), 0) 
      FROM trade_campaign_sellout_entries 
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
        AND entry_type = 'sell_out' 
        AND period = 'atual'
        AND validation_status = 'approved'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.campaign_id, OLD.campaign_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION update_campaign_actual_cost()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE trade_campaigns
  SET 
    actual_cost = (
      SELECT COALESCE(SUM(valor_realizado), 0) 
      FROM trade_campaign_expenses 
      WHERE campaign_id = COALESCE(NEW.campaign_id, OLD.campaign_id) 
        AND status = 'aprovado'
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.campaign_id, OLD.campaign_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION check_campaign_expense_limit()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_orcado NUMERIC;
  v_total_gastos NUMERIC;
  v_campaign_status VARCHAR;
BEGIN
  SELECT verba_orcada, status INTO v_orcado, v_campaign_status
  FROM trade_campaigns WHERE id = NEW.campaign_id;
  
  SELECT COALESCE(SUM(valor_realizado), 0) INTO v_total_gastos
  FROM trade_campaign_expenses
  WHERE campaign_id = NEW.campaign_id 
    AND status = 'aprovado'
    AND id != NEW.id;
  
  IF NEW.status = 'aprovado' AND v_orcado > 0 AND (v_total_gastos + NEW.valor_realizado) > v_orcado THEN
    RAISE EXCEPTION 'Gastos ultrapassam o orçamento aprovado. Verba orçada: R$ %, Já utilizado: R$ %, Disponível: R$ %', 
      v_orcado, v_total_gastos, (v_orcado - v_total_gastos);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION log_campaign_changes()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
BEGIN
  SELECT nome INTO v_user_name FROM profiles WHERE id = auth.uid();
  
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO trade_campaign_audit_log (campaign_id, action, field_changed, old_value, new_value, user_id, user_name)
      VALUES (NEW.id, 'status_changed', 'status', OLD.status, NEW.status, auth.uid(), v_user_name);
    END IF;
    
    IF OLD.validation_status IS DISTINCT FROM NEW.validation_status THEN
      INSERT INTO trade_campaign_audit_log (campaign_id, action, field_changed, old_value, new_value, user_id, user_name)
      VALUES (NEW.id, 'validation_changed', 'validation_status', OLD.validation_status, NEW.validation_status, auth.uid(), v_user_name);
    END IF;
    
    IF OLD.verba_orcada IS DISTINCT FROM NEW.verba_orcada THEN
      INSERT INTO trade_campaign_audit_log (campaign_id, action, field_changed, old_value, new_value, user_id, user_name)
      VALUES (NEW.id, 'budget_changed', 'verba_orcada', OLD.verba_orcada::TEXT, NEW.verba_orcada::TEXT, auth.uid(), v_user_name);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;