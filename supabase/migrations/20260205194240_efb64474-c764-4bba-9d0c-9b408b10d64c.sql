
-- ============================================================
-- CORREÇÃO: Isolamento de dados por hierarquia em photos e visits
-- ============================================================

-- =========================
-- PARTE 1: TABELA PHOTOS
-- =========================

-- Remover TODAS as políticas existentes de photos para começar limpo
DROP POLICY IF EXISTS "Admins e supervisores podem ver todas as fotos" ON public.photos;
DROP POLICY IF EXISTS "Supervisores podem ver fotos de subordinados" ON public.photos;
DROP POLICY IF EXISTS "Usuários gerenciam próprias fotos" ON public.photos;
DROP POLICY IF EXISTS "Usuários veem fotos permitidas" ON public.photos;
DROP POLICY IF EXISTS "Vendedores podem ver suas próprias fotos" ON public.photos;
DROP POLICY IF EXISTS "Vendedor atualiza suas fotos" ON public.photos;
DROP POLICY IF EXISTS "Admin deleta fotos" ON public.photos;
DROP POLICY IF EXISTS "Vendedor e supervisor criam fotos" ON public.photos;

-- SELECT: Admin vê todas as fotos
CREATE POLICY "photos_select_admin"
ON public.photos FOR SELECT
USING (is_admin());

-- SELECT: Supervisor vê fotos dos subordinados diretos
CREATE POLICY "photos_select_supervisor"
ON public.photos FOR SELECT
USING (is_supervisor_of(vendedor_id, auth.uid()));

-- SELECT: Vendedor vê suas próprias fotos
CREATE POLICY "photos_select_own"
ON public.photos FOR SELECT
USING (vendedor_id = auth.uid());

-- SELECT: Fotos vinculadas a visitas que o usuário pode ver
CREATE POLICY "photos_select_via_visit"
ON public.photos FOR SELECT
USING (
  visit_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM visits v 
    WHERE v.id = photos.visit_id 
    AND (
      v.user_id = auth.uid() 
      OR is_supervisor_of(v.user_id, auth.uid())
    )
  )
);

-- INSERT: Usuários autenticados podem criar fotos
CREATE POLICY "photos_insert_authenticated"
ON public.photos FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Vendedor atualiza suas fotos OU admin
CREATE POLICY "photos_update_own_or_admin"
ON public.photos FOR UPDATE
USING (vendedor_id = auth.uid() OR is_admin());

-- DELETE: Apenas admin pode deletar fotos
CREATE POLICY "photos_delete_admin"
ON public.photos FOR DELETE
USING (is_admin());

-- =========================
-- PARTE 2: TABELA VISITS
-- =========================

-- Remover TODAS as políticas existentes de visits para começar limpo
DROP POLICY IF EXISTS "Admin vê todas visitas" ON public.visits;
DROP POLICY IF EXISTS "Admins can delete visits" ON public.visits;
DROP POLICY IF EXISTS "Admins e supervisores podem deletar visitas" ON public.visits;
DROP POLICY IF EXISTS "Admins podem deletar visitas" ON public.visits;
DROP POLICY IF EXISTS "Supervisor vê visitas de subordinados" ON public.visits;
DROP POLICY IF EXISTS "Users can insert own visits" ON public.visits;
DROP POLICY IF EXISTS "Users can update own visits" ON public.visits;
DROP POLICY IF EXISTS "Users can view visits based on role" ON public.visits;
DROP POLICY IF EXISTS "Usuários atualizam visitas conforme hierarquia" ON public.visits;
DROP POLICY IF EXISTS "Usuários autenticados criam visitas" ON public.visits;
DROP POLICY IF EXISTS "Usuários podem atualizar próprias visitas" ON public.visits;
DROP POLICY IF EXISTS "Usuários podem atualizar suas visitas" ON public.visits;
DROP POLICY IF EXISTS "Usuários podem criar visitas" ON public.visits;
DROP POLICY IF EXISTS "Usuários veem visitas conforme hierarquia" ON public.visits;
DROP POLICY IF EXISTS "Vendedor vê suas visitas" ON public.visits;
DROP POLICY IF EXISTS "visits_delete_restricted" ON public.visits;
DROP POLICY IF EXISTS "visits_insert_restricted" ON public.visits;
DROP POLICY IF EXISTS "visits_select_restricted" ON public.visits;
DROP POLICY IF EXISTS "visits_update_restricted" ON public.visits;

-- SELECT: Admin vê todas as visitas
CREATE POLICY "visits_select_admin"
ON public.visits FOR SELECT
USING (is_admin());

-- SELECT: Supervisor vê visitas dos subordinados (usando get_subordinados)
CREATE POLICY "visits_select_supervisor"
ON public.visits FOR SELECT
USING (
  has_role(auth.uid(), 'supervisor'::app_role) AND (
    user_id = auth.uid()
    OR user_id IN (SELECT subordinado_id FROM get_subordinados(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM stores s 
      WHERE s.id = visits.store_id 
      AND s.supervisor_id = auth.uid()
    )
  )
);

-- SELECT: Vendedor/Promotor vê suas próprias visitas
CREATE POLICY "visits_select_own"
ON public.visits FOR SELECT
USING (user_id = auth.uid());

-- INSERT: Usuários autenticados podem criar visitas
CREATE POLICY "visits_insert_authenticated"
ON public.visits FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Próprio usuário, supervisor do vendedor, ou admin
CREATE POLICY "visits_update_own_or_hierarchy"
ON public.visits FOR UPDATE
USING (
  user_id = auth.uid()
  OR is_admin()
  OR (has_role(auth.uid(), 'supervisor'::app_role) AND is_supervisor_of(user_id, auth.uid()))
);

-- DELETE: Admin ou supervisor do vendedor da visita
CREATE POLICY "visits_delete_admin_or_supervisor"
ON public.visits FOR DELETE
USING (
  is_admin()
  OR (has_role(auth.uid(), 'supervisor'::app_role) AND is_supervisor_of(user_id, auth.uid()))
);
