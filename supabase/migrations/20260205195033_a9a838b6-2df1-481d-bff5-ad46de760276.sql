
-- CORREÇÃO: Incluir vendedor_id na política de stores
-- O sistema usa vendedor_id diretamente na tabela stores, não store_sellers

-- Recriar política de supervisor incluindo vendedor_id
DROP POLICY IF EXISTS "stores_select_supervisor" ON public.stores;
CREATE POLICY "stores_select_supervisor"
ON public.stores FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND (
    -- Store onde o supervisor é o supervisor direto
    supervisor_id = auth.uid()
    -- Store que o supervisor criou
    OR created_by = auth.uid()
    -- Store onde vendedor_id é o próprio supervisor
    OR vendedor_id = auth.uid()
    -- Store onde vendedor_id é um subordinado
    OR vendedor_id IN (SELECT subordinado_id FROM get_subordinados(auth.uid()))
    -- Store vinculada via store_sellers (backup)
    OR EXISTS (
      SELECT 1 FROM store_sellers ss 
      WHERE ss.store_id = stores.id 
      AND (
        ss.vendedor_id = auth.uid()
        OR ss.vendedor_id IN (SELECT subordinado_id FROM get_subordinados(auth.uid()))
      )
    )
  )
);

-- Recriar política de vendedor incluindo vendedor_id
DROP POLICY IF EXISTS "stores_select_own" ON public.stores;
CREATE POLICY "stores_select_own"
ON public.stores FOR SELECT
USING (
  -- Store onde vendedor_id é o usuário
  vendedor_id = auth.uid()
  -- Store que o usuário criou
  OR created_by = auth.uid()
  -- Store vinculada via store_sellers
  OR EXISTS (
    SELECT 1 FROM store_sellers ss 
    WHERE ss.store_id = stores.id 
    AND ss.vendedor_id = auth.uid()
  )
);
