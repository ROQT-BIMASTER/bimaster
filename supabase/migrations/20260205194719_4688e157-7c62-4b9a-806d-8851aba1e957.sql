
-- ============================================================
-- CORREÇÃO CRÍTICA: Inversão de parâmetros is_supervisor_of
-- e isolamento de stores (PDVs) por hierarquia
-- ============================================================

-- =========================
-- PARTE 1: CORRIGIR PHOTOS - parâmetros invertidos
-- =========================

-- Recriar política de supervisor com parâmetros CORRETOS
DROP POLICY IF EXISTS "photos_select_supervisor" ON public.photos;
CREATE POLICY "photos_select_supervisor"
ON public.photos FOR SELECT
USING (is_supervisor_of(auth.uid(), vendedor_id));

-- Recriar política via visita com parâmetros CORRETOS
DROP POLICY IF EXISTS "photos_select_via_visit" ON public.photos;
CREATE POLICY "photos_select_via_visit"
ON public.photos FOR SELECT
USING (
  visit_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM visits v 
    WHERE v.id = photos.visit_id 
    AND (
      v.user_id = auth.uid() 
      OR is_supervisor_of(auth.uid(), v.user_id)
    )
  )
);

-- =========================
-- PARTE 2: CORRIGIR VISITS - parâmetros invertidos no UPDATE/DELETE
-- =========================

DROP POLICY IF EXISTS "visits_update_own_or_hierarchy" ON public.visits;
CREATE POLICY "visits_update_own_or_hierarchy"
ON public.visits FOR UPDATE
USING (
  user_id = auth.uid()
  OR is_admin()
  OR (has_role(auth.uid(), 'supervisor'::app_role) AND is_supervisor_of(auth.uid(), user_id))
);

DROP POLICY IF EXISTS "visits_delete_admin_or_supervisor" ON public.visits;
CREATE POLICY "visits_delete_admin_or_supervisor"
ON public.visits FOR DELETE
USING (
  is_admin()
  OR (has_role(auth.uid(), 'supervisor'::app_role) AND is_supervisor_of(auth.uid(), user_id))
);

-- =========================
-- PARTE 3: CORRIGIR STORES (PDVs) - supervisores veem TUDO
-- =========================

-- Remover políticas permissivas de stores
DROP POLICY IF EXISTS "stores_select_consolidated" ON public.stores;
DROP POLICY IF EXISTS "stores_update_consolidated" ON public.stores;
DROP POLICY IF EXISTS "stores_delete_consolidated" ON public.stores;
DROP POLICY IF EXISTS "stores_insert_consolidated" ON public.stores;

-- SELECT: Admin vê todos os PDVs
CREATE POLICY "stores_select_admin"
ON public.stores FOR SELECT
USING (is_admin());

-- SELECT: Supervisor vê PDVs onde é supervisor ou de seus subordinados
CREATE POLICY "stores_select_supervisor"
ON public.stores FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND (
    supervisor_id = auth.uid()
    OR created_by = auth.uid()
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

-- SELECT: Vendedor/Promotor vê PDVs vinculados a ele
CREATE POLICY "stores_select_own"
ON public.stores FOR SELECT
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM store_sellers ss 
    WHERE ss.store_id = stores.id 
    AND ss.vendedor_id = auth.uid()
  )
);

-- INSERT: Usuários autenticados podem criar PDVs
CREATE POLICY "stores_insert_authenticated"
ON public.stores FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Dono, supervisor hierárquico ou admin
CREATE POLICY "stores_update_own_or_hierarchy"
ON public.stores FOR UPDATE
USING (
  is_admin()
  OR supervisor_id = auth.uid()
  OR created_by = auth.uid()
);

-- DELETE: Apenas admin
CREATE POLICY "stores_delete_admin"
ON public.stores FOR DELETE
USING (is_admin());
