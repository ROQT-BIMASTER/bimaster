
-- =============================================
-- CORREÇÃO DE SEGURANÇA: RLS RESTRITIVO (Parte 2)
-- Completar políticas que faltaram
-- =============================================

-- CONTAS_PAGAR - Remover políticas existentes e recriar
DROP POLICY IF EXISTS "contas_pagar_insert_admin" ON public.contas_pagar;
DROP POLICY IF EXISTS "contas_pagar_update_admin" ON public.contas_pagar;
DROP POLICY IF EXISTS "contas_pagar_delete_admin" ON public.contas_pagar;
DROP POLICY IF EXISTS "contas_pagar_select_admin" ON public.contas_pagar;

-- Apenas admin/supervisor podem ver contas a pagar
CREATE POLICY "contas_pagar_select_admin_v2" ON public.contas_pagar
FOR SELECT TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "contas_pagar_insert_admin_v2" ON public.contas_pagar
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "contas_pagar_update_admin_v2" ON public.contas_pagar
FOR UPDATE TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "contas_pagar_delete_admin_v2" ON public.contas_pagar
FOR DELETE TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

-- PROSPECTS - Remover políticas existentes e recriar
DROP POLICY IF EXISTS "prospects_select_assigned" ON public.prospects;
DROP POLICY IF EXISTS "prospects_insert_auth" ON public.prospects;
DROP POLICY IF EXISTS "prospects_update_assigned" ON public.prospects;
DROP POLICY IF EXISTS "prospects_delete_admin" ON public.prospects;
DROP POLICY IF EXISTS "Prospects_select_policy" ON public.prospects;

-- Vendedores veem apenas prospects atribuídos, admin/supervisor veem todos
CREATE POLICY "prospects_select_restricted" ON public.prospects
FOR SELECT TO authenticated
USING (
  vendedor_id = auth.uid() 
  OR public.is_admin_or_supervisor(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.usuario_prospects 
    WHERE usuario_id = auth.uid() AND prospect_id = prospects.id
  )
);

CREATE POLICY "prospects_insert_restricted" ON public.prospects
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "prospects_update_restricted" ON public.prospects
FOR UPDATE TO authenticated
USING (
  vendedor_id = auth.uid() 
  OR public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "prospects_delete_restricted" ON public.prospects
FOR DELETE TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

-- STORES - Remover políticas existentes e recriar
DROP POLICY IF EXISTS "stores_select_auth" ON public.stores;
DROP POLICY IF EXISTS "stores_insert_admin" ON public.stores;
DROP POLICY IF EXISTS "stores_update_admin" ON public.stores;
DROP POLICY IF EXISTS "stores_delete_admin" ON public.stores;
DROP POLICY IF EXISTS "Stores_select_policy" ON public.stores;

CREATE POLICY "stores_select_restricted" ON public.stores
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "stores_insert_restricted" ON public.stores
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "stores_update_restricted" ON public.stores
FOR UPDATE TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "stores_delete_restricted" ON public.stores
FOR DELETE TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

-- VISITS - Remover políticas existentes e recriar
DROP POLICY IF EXISTS "visits_select_own" ON public.visits;
DROP POLICY IF EXISTS "visits_insert_own" ON public.visits;
DROP POLICY IF EXISTS "visits_update_own" ON public.visits;
DROP POLICY IF EXISTS "visits_delete_admin" ON public.visits;
DROP POLICY IF EXISTS "Visits_select_policy" ON public.visits;

CREATE POLICY "visits_select_restricted" ON public.visits
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() 
  OR public.is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "visits_insert_restricted" ON public.visits
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "visits_update_restricted" ON public.visits
FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "visits_delete_restricted" ON public.visits
FOR DELETE TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

-- MUNICIPIOS - Remover políticas existentes e recriar
DROP POLICY IF EXISTS "municipios_select_auth" ON public.municipios;
DROP POLICY IF EXISTS "municipios_modify_admin" ON public.municipios;
DROP POLICY IF EXISTS "Municipios_select_policy" ON public.municipios;

CREATE POLICY "municipios_select_restricted" ON public.municipios
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "municipios_modify_restricted" ON public.municipios
FOR ALL TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()))
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));

-- CONTAS_RECEBER - Remover políticas existentes e recriar
DROP POLICY IF EXISTS "contas_receber_select_admin" ON public.contas_receber;
DROP POLICY IF EXISTS "contas_receber_modify_admin" ON public.contas_receber;

CREATE POLICY "contas_receber_select_restricted" ON public.contas_receber
FOR SELECT TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

CREATE POLICY "contas_receber_modify_restricted" ON public.contas_receber
FOR ALL TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()))
WITH CHECK (public.is_admin_or_supervisor(auth.uid()));
