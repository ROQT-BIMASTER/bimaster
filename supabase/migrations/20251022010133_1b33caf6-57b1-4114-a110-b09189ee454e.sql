-- Add defense-in-depth authorization check to SECURITY DEFINER trigger
-- This provides an additional security layer even though RLS already protects INSERT

CREATE OR REPLACE FUNCTION public.update_bank_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance NUMERIC(15,2);
BEGIN
  -- ✅ Defense-in-depth: Explicit authorization check
  -- Even though INSERT on trade_bank_transactions is RLS-protected,
  -- this ensures the function itself validates permissions
  IF NOT is_admin_or_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admin/supervisor can modify bank balances';
  END IF;
  
  -- Calcular novo saldo baseado no tipo de transação
  IF NEW.transaction_type = 'credit' THEN
    SELECT current_balance + NEW.amount INTO new_balance
    FROM trade_bank_accounts
    WHERE id = NEW.bank_account_id;
  ELSE -- debit
    SELECT current_balance - NEW.amount INTO new_balance
    FROM trade_bank_accounts
    WHERE id = NEW.bank_account_id;
  END IF;
  
  -- Atualizar saldo da conta
  UPDATE trade_bank_accounts
  SET current_balance = new_balance,
      updated_at = now()
  WHERE id = NEW.bank_account_id;
  
  -- Registrar saldo após transação
  NEW.balance_after := new_balance;
  
  RETURN NEW;
END;
$$;