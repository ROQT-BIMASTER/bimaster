-- Corrigir search_path nas funções existentes para segurança
ALTER FUNCTION public.validate_investment_date() SET search_path = public;
ALTER FUNCTION public.validate_budget_period() SET search_path = public;