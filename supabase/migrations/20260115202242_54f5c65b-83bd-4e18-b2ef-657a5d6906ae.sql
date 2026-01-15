
-- =====================================================
-- CORREÇÃO DE SEGURANÇA ABRANGENTE - PARTE 1
-- Corrigir funções sem search_path
-- =====================================================

-- 1. DROP e recriar user_has_store_access com search_path
DROP FUNCTION IF EXISTS public.user_has_store_access(uuid, uuid);

CREATE FUNCTION public.user_has_store_access(p_store_id uuid, p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.store_seller_assignments
    WHERE user_id = p_user_id AND store_id = p_store_id AND is_active = true
  ) OR public.is_admin_or_supervisor(p_user_id);
END;
$$;

-- 2. check_max_sellers_per_store
CREATE OR REPLACE FUNCTION public.check_max_sellers_per_store()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  seller_count INTEGER;
  max_sellers INTEGER := 3;
BEGIN
  SELECT COUNT(*) INTO seller_count
  FROM public.store_seller_assignments
  WHERE store_id = NEW.store_id AND is_active = true;
  
  IF seller_count >= max_sellers THEN
    RAISE EXCEPTION 'Loja já possui o máximo de % vendedores ativos', max_sellers;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. ensure_single_principal_seller
CREATE OR REPLACE FUNCTION public.ensure_single_principal_seller()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_principal = true THEN
    UPDATE public.store_seller_assignments
    SET is_principal = false
    WHERE store_id = NEW.store_id
      AND id != NEW.id
      AND is_principal = true;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. set_vendedor_id_gondola
CREATE OR REPLACE FUNCTION public.set_vendedor_id_gondola()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.vendedor_id := auth.uid();
  RETURN NEW;
END;
$$;

-- 5. set_vendedor_id_sellout
CREATE OR REPLACE FUNCTION public.set_vendedor_id_sellout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.vendedor_id := auth.uid();
  RETURN NEW;
END;
$$;
