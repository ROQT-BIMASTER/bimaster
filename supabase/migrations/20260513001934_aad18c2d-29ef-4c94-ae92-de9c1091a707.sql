-- Estende a permissão de escrita do SLA da timeline China-Brasil para supervisores,
-- mantendo administradores com controle total.

DROP POLICY IF EXISTS "china_timeline_sla_insert_admin" ON public.china_timeline_sla;
DROP POLICY IF EXISTS "china_timeline_sla_update_admin" ON public.china_timeline_sla;
DROP POLICY IF EXISTS "china_timeline_sla_delete_admin" ON public.china_timeline_sla;

CREATE POLICY "china_timeline_sla_insert_admin_supervisor"
  ON public.china_timeline_sla
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

CREATE POLICY "china_timeline_sla_update_admin_supervisor"
  ON public.china_timeline_sla
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

-- Exclusão permanece restrita a administradores.
CREATE POLICY "china_timeline_sla_delete_admin"
  ON public.china_timeline_sla
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));