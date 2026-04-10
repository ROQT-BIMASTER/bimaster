
-- Fix kpis_tracking: drop unrestricted USING(true) policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver KPIs" ON public.kpis_tracking;

-- Fix store_stock_movements: drop unrestricted USING(true) policy
DROP POLICY IF EXISTS "Usuários autenticados podem ver movimentações" ON public.store_stock_movements;
