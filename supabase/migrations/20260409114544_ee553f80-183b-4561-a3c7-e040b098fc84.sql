
-- store_stock_movements: restrict SELECT
DROP POLICY IF EXISTS "store_stock_movements_select" ON public.store_stock_movements;
DROP POLICY IF EXISTS "Authenticated users can view stock movements" ON public.store_stock_movements;
DROP POLICY IF EXISTS "Anyone can view stock movements" ON public.store_stock_movements;

CREATE POLICY "store_stock_movements_select_restricted"
ON public.store_stock_movements
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
  OR store_id IN (SELECT store_id FROM public.store_sellers WHERE vendedor_id = auth.uid())
);

-- kpis_tracking: restrict SELECT via store_id
DROP POLICY IF EXISTS "kpis_tracking_select" ON public.kpis_tracking;
DROP POLICY IF EXISTS "Authenticated users can view kpis" ON public.kpis_tracking;
DROP POLICY IF EXISTS "Anyone can view kpis_tracking" ON public.kpis_tracking;

CREATE POLICY "kpis_tracking_select_restricted"
ON public.kpis_tracking
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
  OR store_id IN (SELECT store_id FROM public.store_sellers WHERE vendedor_id = auth.uid())
);

-- conciliacao_uploads: split into per-operation policies
DROP POLICY IF EXISTS "conciliacao_uploads_all" ON public.conciliacao_uploads;
DROP POLICY IF EXISTS "Authenticated users can manage conciliacao_uploads" ON public.conciliacao_uploads;
DROP POLICY IF EXISTS "Users can manage their conciliacao_uploads" ON public.conciliacao_uploads;

CREATE POLICY "conciliacao_uploads_select_own"
ON public.conciliacao_uploads FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
);

CREATE POLICY "conciliacao_uploads_insert_own"
ON public.conciliacao_uploads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "conciliacao_uploads_update_own"
ON public.conciliacao_uploads FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
);

CREATE POLICY "conciliacao_uploads_delete_own"
ON public.conciliacao_uploads FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- market_coverage_snapshot: restrict mutations
DROP POLICY IF EXISTS "market_coverage_snapshot_all" ON public.market_coverage_snapshot;
DROP POLICY IF EXISTS "Authenticated users can manage market_coverage_snapshot" ON public.market_coverage_snapshot;
DROP POLICY IF EXISTS "Users can manage market_coverage_snapshot" ON public.market_coverage_snapshot;

CREATE POLICY "market_coverage_snapshot_select"
ON public.market_coverage_snapshot FOR SELECT TO authenticated
USING (true);

CREATE POLICY "market_coverage_snapshot_insert_admin"
ON public.market_coverage_snapshot FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));

CREATE POLICY "market_coverage_snapshot_update_admin"
ON public.market_coverage_snapshot FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));

CREATE POLICY "market_coverage_snapshot_delete_admin"
ON public.market_coverage_snapshot FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
