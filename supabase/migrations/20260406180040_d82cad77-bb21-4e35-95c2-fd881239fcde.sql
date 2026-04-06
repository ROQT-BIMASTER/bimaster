
-- Restringir agg_daily_kpis SELECT a admin/supervisor/gerente/comercial
DROP POLICY IF EXISTS "Usuários aprovados podem ver KPIs agregados" ON public.agg_daily_kpis;
CREATE POLICY "agg_daily_kpis_select_restricted" ON public.agg_daily_kpis
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'supervisor'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
    OR usuario_tem_acesso_modulo(auth.uid(), 'comercial'::text)
  );
