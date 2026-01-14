-- =====================================================
-- CORREÇÃO GLOBAL DO SISTEMA - TODAS AS FASES
-- =====================================================

-- =====================================================
-- FASE 1: FUNÇÃO PARA CALCULAR STATUS FINANCEIRO
-- =====================================================

CREATE OR REPLACE FUNCTION public.calcular_status_financeiro(
  p_data_vencimento DATE,
  p_data_pagamento DATE,
  p_valor_pago NUMERIC,
  p_valor_original NUMERIC
) RETURNS TEXT AS $$
BEGIN
  IF p_data_pagamento IS NOT NULL AND p_valor_pago >= p_valor_original THEN
    RETURN 'pago';
  END IF;
  
  IF p_valor_pago > 0 AND p_valor_pago < p_valor_original THEN
    RETURN 'parcial';
  END IF;
  
  IF p_data_vencimento IS NULL THEN
    RETURN 'pendente';
  END IF;
  
  IF p_data_vencimento < CURRENT_DATE THEN
    RETURN 'vencido';
  END IF;
  
  RETURN 'pendente';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- FASE 2: TABELA DE MÚLTIPLOS VENDEDORES POR LOJA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.store_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  vendedor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_principal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(store_id, vendedor_id)
);

CREATE INDEX IF NOT EXISTS idx_store_sellers_store_id ON public.store_sellers(store_id);
CREATE INDEX IF NOT EXISTS idx_store_sellers_vendedor_id ON public.store_sellers(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_store_sellers_is_principal ON public.store_sellers(is_principal) WHERE is_principal = true;

ALTER TABLE public.store_sellers ENABLE ROW LEVEL SECURITY;

-- RLS usando user_roles (apenas roles válidos: admin, supervisor)
CREATE POLICY "Admins podem ver todos os vínculos" 
ON public.store_sellers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'supervisor')
  )
);

CREATE POLICY "Vendedores podem ver seus próprios vínculos" 
ON public.store_sellers FOR SELECT
USING (vendedor_id = auth.uid());

CREATE POLICY "Admins podem gerenciar vínculos" 
ON public.store_sellers FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Função para garantir máximo 5 vendedores por loja
CREATE OR REPLACE FUNCTION public.check_max_sellers_per_store()
RETURNS TRIGGER AS $$
DECLARE
  seller_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO seller_count 
  FROM public.store_sellers 
  WHERE store_id = NEW.store_id;
  
  IF seller_count >= 5 THEN
    RAISE EXCEPTION 'Máximo de 5 vendedores por loja atingido';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_max_sellers_per_store ON public.store_sellers;
CREATE TRIGGER enforce_max_sellers_per_store
BEFORE INSERT ON public.store_sellers
FOR EACH ROW
EXECUTE FUNCTION public.check_max_sellers_per_store();

-- Função para garantir apenas 1 vendedor principal por loja
CREATE OR REPLACE FUNCTION public.ensure_single_principal_seller()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_principal = true THEN
    UPDATE public.store_sellers 
    SET is_principal = false 
    WHERE store_id = NEW.store_id 
    AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_single_principal ON public.store_sellers;
CREATE TRIGGER ensure_single_principal
AFTER INSERT OR UPDATE OF is_principal ON public.store_sellers
FOR EACH ROW
WHEN (NEW.is_principal = true)
EXECUTE FUNCTION public.ensure_single_principal_seller();

-- Migrar dados existentes
INSERT INTO public.store_sellers (store_id, vendedor_id, is_principal, created_at)
SELECT id, vendedor_id, true, NOW()
FROM public.stores 
WHERE vendedor_id IS NOT NULL
ON CONFLICT (store_id, vendedor_id) DO NOTHING;

-- =====================================================
-- FASE 3: VIEW PARA LOJAS COM VENDEDORES
-- =====================================================

CREATE OR REPLACE VIEW public.stores_with_sellers
WITH (security_invoker=on) AS
SELECT 
  s.*,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'id', ss.id,
      'vendedor_id', ss.vendedor_id,
      'is_principal', ss.is_principal,
      'vendedor_nome', p.nome,
      'vendedor_email', p.email
    ))
    FROM public.store_sellers ss
    LEFT JOIN public.profiles p ON ss.vendedor_id = p.id
    WHERE ss.store_id = s.id),
    '[]'::jsonb
  ) as vendedores,
  (SELECT ss.vendedor_id FROM public.store_sellers ss WHERE ss.store_id = s.id AND ss.is_principal = true LIMIT 1) as vendedor_principal_id
FROM public.stores s;

-- =====================================================
-- FASE 4: ATUALIZAR RLS DE STORES
-- =====================================================

DROP POLICY IF EXISTS "Vendedores veem apenas suas lojas" ON public.stores;
DROP POLICY IF EXISTS "stores_vendedor_select" ON public.stores;
DROP POLICY IF EXISTS "Vendedores veem lojas vinculadas" ON public.stores;

CREATE POLICY "Vendedores veem lojas vinculadas" 
ON public.stores FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'supervisor')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.store_sellers 
    WHERE store_id = stores.id 
    AND vendedor_id = auth.uid()
  )
  OR
  vendedor_id = auth.uid()
);

-- =====================================================
-- FASE 5: ADICIONAR VENDEDOR_ID A GONDOLA_AUDITS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'gondola_audits' AND column_name = 'vendedor_id'
  ) THEN
    ALTER TABLE public.gondola_audits ADD COLUMN vendedor_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gondola_audits_vendedor_id ON public.gondola_audits(vendedor_id);

-- =====================================================
-- FASE 6: ADICIONAR VENDEDOR_ID A STORE_SELLOUTS
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'store_sellouts' AND column_name = 'vendedor_id'
  ) THEN
    ALTER TABLE public.store_sellouts ADD COLUMN vendedor_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_store_sellouts_vendedor_id ON public.store_sellouts(vendedor_id);

-- =====================================================
-- FASE 7: FUNÇÃO HELPER PARA VERIFICAR ACESSO A LOJA
-- =====================================================

CREATE OR REPLACE FUNCTION public.user_has_store_access(p_store_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = p_user_id 
    AND role IN ('admin', 'supervisor')
  ) THEN
    RETURN true;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.store_sellers 
    WHERE store_id = p_store_id 
    AND vendedor_id = p_user_id
  ) THEN
    RETURN true;
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.stores 
    WHERE id = p_store_id 
    AND vendedor_id = p_user_id
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- FASE 8: TRIGGERS PARA PREENCHER VENDEDOR_ID
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_vendedor_id_gondola()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendedor_id IS NULL THEN
    NEW.vendedor_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_vendedor_gondola ON public.gondola_audits;
CREATE TRIGGER set_vendedor_gondola
BEFORE INSERT ON public.gondola_audits
FOR EACH ROW
EXECUTE FUNCTION public.set_vendedor_id_gondola();

CREATE OR REPLACE FUNCTION public.set_vendedor_id_sellout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendedor_id IS NULL THEN
    NEW.vendedor_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_vendedor_sellout ON public.store_sellouts;
CREATE TRIGGER set_vendedor_sellout
BEFORE INSERT ON public.store_sellouts
FOR EACH ROW
EXECUTE FUNCTION public.set_vendedor_id_sellout();