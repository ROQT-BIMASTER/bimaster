-- ============================================
-- CORREÇÃO FINAL DOS WARNINGS - FUNÇÕES TRIGGER
-- ============================================

-- 1. Função log_changes (trigger de auditoria)
CREATE OR REPLACE FUNCTION public.log_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- 2. Função distribuir_prospect_automaticamente
CREATE OR REPLACE FUNCTION public.distribuir_prospect_automaticamente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Se o prospect já tem vendedor, não faz nada
  IF NEW.vendedor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Se o prospect tem município_id, busca o vendedor do município
  IF NEW.municipio_id IS NOT NULL THEN
    SELECT vendedor_id INTO NEW.vendedor_id
    FROM public.municipios
    WHERE id = NEW.municipio_id
    AND vendedor_id IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Função auditar_mudanca_municipio_vendedor
CREATE OR REPLACE FUNCTION public.auditar_mudanca_municipio_vendedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.vendedor_id IS DISTINCT FROM NEW.vendedor_id THEN
    INSERT INTO public.auditoria_atribuicoes (
      tipo,
      entidade_id,
      entidade_tipo,
      vendedor_antigo_id,
      vendedor_novo_id,
      usuario_id,
      detalhes
    ) VALUES (
      'municipio_vendedor',
      NEW.id,
      'municipio',
      OLD.vendedor_id,
      NEW.vendedor_id,
      auth.uid(),
      jsonb_build_object(
        'municipio_nome', NEW.nome,
        'municipio_uf', NEW.uf
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Função update_conversa_timestamp
CREATE OR REPLACE FUNCTION public.update_conversa_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.conversas
  SET updated_at = now()
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$;

-- 5. Função update_assinatura_timestamp
CREATE OR REPLACE FUNCTION public.update_assinatura_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 6. Função update_goals_updated_at
CREATE OR REPLACE FUNCTION public.update_goals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 7. Função update_ai_calls_updated_at
CREATE OR REPLACE FUNCTION public.update_ai_calls_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 8. Função update_store_products_updated_at
CREATE OR REPLACE FUNCTION public.update_store_products_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 9. Função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 10. Função update_stock_after_sellout
CREATE OR REPLACE FUNCTION public.update_stock_after_sellout()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Atualizar o estoque do produto
  UPDATE public.store_products
  SET current_stock = current_stock - NEW.quantity
  WHERE id = NEW.product_id;
  
  -- Registrar movimentação de estoque
  INSERT INTO public.store_stock_movements (
    store_id,
    product_id,
    movement_type,
    quantity,
    previous_stock,
    new_stock,
    reason,
    created_by
  )
  SELECT
    NEW.store_id,
    NEW.product_id,
    'saida',
    NEW.quantity,
    sp.current_stock + NEW.quantity,
    sp.current_stock,
    'Sell out registrado',
    NEW.created_by
  FROM public.store_products sp
  WHERE sp.id = NEW.product_id;
  
  RETURN NEW;
END;
$$;

-- 11. Função update_budget_reserved_amount
CREATE OR REPLACE FUNCTION public.update_budget_reserved_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- 12. Função validate_budget_reserve
CREATE OR REPLACE FUNCTION public.validate_budget_reserve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  budget_available NUMERIC(15,2);
BEGIN
  SELECT (total_amount - COALESCE(spent_amount, 0) - COALESCE(reserved_amount, 0))
  INTO budget_available
  FROM public.trade_budgets
  WHERE id = NEW.budget_id;
  
  IF budget_available < NEW.reserved_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente na verba. Disponível: R$ %', budget_available;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 13. Função validate_investment_date
CREATE OR REPLACE FUNCTION public.validate_investment_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.investment_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Data do investimento não pode ser futura';
  END IF;
  RETURN NEW;
END;
$$;

-- 14. Função validate_budget_period
CREATE OR REPLACE FUNCTION public.validate_budget_period()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.period_end <= NEW.period_start THEN
    RAISE EXCEPTION 'Data de fim deve ser posterior à data de início';
  END IF;
  RETURN NEW;
END;
$$;

-- 15. Função update_bank_account_balance
CREATE OR REPLACE FUNCTION public.update_bank_account_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_balance NUMERIC(15,2);
BEGIN
  -- ✅ Defense-in-depth: Explicit authorization check
  IF NOT public.is_admin_or_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only admin/supervisor can modify bank balances';
  END IF;
  
  -- Calcular novo saldo baseado no tipo de transação
  IF NEW.transaction_type = 'credit' THEN
    SELECT current_balance + NEW.amount INTO new_balance
    FROM public.trade_bank_accounts
    WHERE id = NEW.bank_account_id;
  ELSE -- debit
    SELECT current_balance - NEW.amount INTO new_balance
    FROM public.trade_bank_accounts
    WHERE id = NEW.bank_account_id;
  END IF;
  
  -- Atualizar saldo da conta
  UPDATE public.trade_bank_accounts
  SET current_balance = new_balance,
      updated_at = now()
  WHERE id = NEW.bank_account_id;
  
  -- Registrar saldo após transação
  NEW.balance_after := new_balance;
  
  RETURN NEW;
END;
$$;

-- Comentários de segurança
COMMENT ON FUNCTION public.log_changes IS 'Trigger de auditoria - SECURITY DEFINER com search_path vazio';
COMMENT ON FUNCTION public.distribuir_prospect_automaticamente IS 'Distribuição automática de prospects - SECURITY DEFINER com search_path vazio';
COMMENT ON FUNCTION public.auditar_mudanca_municipio_vendedor IS 'Auditoria de mudança de vendedor - SECURITY DEFINER com search_path vazio';