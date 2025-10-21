-- Função para consumir crédito da verba quando lançamento é aprovado
CREATE OR REPLACE FUNCTION public.consume_budget_credit(
  p_budget_id UUID,
  p_amount NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available NUMERIC;
BEGIN
  -- Calcular saldo disponível
  SELECT (total_amount - COALESCE(spent_amount, 0) - COALESCE(reserved_amount, 0))
  INTO v_available
  FROM trade_budgets
  WHERE id = p_budget_id;
  
  -- Verificar se há saldo suficiente
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente na verba. Disponível: R$ %, Necessário: R$ %', v_available, p_amount;
  END IF;
  
  -- Atualizar spent_amount
  UPDATE trade_budgets
  SET spent_amount = COALESCE(spent_amount, 0) + p_amount,
      updated_at = now()
  WHERE id = p_budget_id;
END;
$$;