DROP POLICY IF EXISTS "vendedores_update" ON public.vendedores;
CREATE POLICY "vendedores_update_admin_supervisor" ON public.vendedores
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "vendedores_insert_admin_supervisor" ON public.vendedores;
CREATE POLICY "vendedores_insert_admin_supervisor" ON public.vendedores
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'supervisor'::app_role));

DROP POLICY IF EXISTS "vendedores_delete_admin" ON public.vendedores;
CREATE POLICY "vendedores_delete_admin" ON public.vendedores
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));