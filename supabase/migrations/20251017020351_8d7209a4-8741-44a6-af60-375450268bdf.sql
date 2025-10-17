-- ==============================================================
-- CORREÇÃO FINAL: Search Path para Triggers Financeiros
-- ==============================================================

-- Recriar funções de trigger com search_path seguro
CREATE OR REPLACE FUNCTION public.validate_budget_period()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.period_end <= NEW.period_start THEN
    RAISE EXCEPTION 'Data de fim deve ser posterior à data de início';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_investment_date()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.investment_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data do investimento não pode ser futura';
  END IF;
  RETURN NEW;
END;
$$;