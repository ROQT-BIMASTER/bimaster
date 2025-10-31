-- Corrigir funções com search_path mutável

-- 1. update_stock_after_sellout
CREATE OR REPLACE FUNCTION public.update_stock_after_sellout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'  -- Adicionar search_path
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

-- 2. update_store_products_updated_at
CREATE OR REPLACE FUNCTION public.update_store_products_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'  -- Adicionar search_path
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'  -- Adicionar search_path
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;