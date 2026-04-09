
-- trade_campaign_lancamentos: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view all launches" ON public.trade_campaign_lancamentos;
CREATE POLICY "trade_campaign_lancamentos_select_scoped"
ON public.trade_campaign_lancamentos FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.trade_campaigns tc
    WHERE tc.id = campaign_id AND tc.responsible_user_id = auth.uid()
  )
);

-- trade_campaign_orders: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view all orders" ON public.trade_campaign_orders;
CREATE POLICY "trade_campaign_orders_select_scoped"
ON public.trade_campaign_orders FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
  OR EXISTS (
    SELECT 1 FROM public.trade_campaigns tc
    WHERE tc.id = campaign_id AND tc.responsible_user_id = auth.uid()
  )
);

-- trade_campaign_products: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view all campaign products" ON public.trade_campaign_products;
CREATE POLICY "trade_campaign_products_select_scoped"
ON public.trade_campaign_products FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
  OR EXISTS (
    SELECT 1 FROM public.trade_campaigns tc
    WHERE tc.id = campaign_id AND tc.responsible_user_id = auth.uid()
  )
);

-- trade_campaign_sellout_entries: restrict SELECT
DROP POLICY IF EXISTS "Authenticated users can view all sellout entries" ON public.trade_campaign_sellout_entries;
CREATE POLICY "trade_campaign_sellout_select_scoped"
ON public.trade_campaign_sellout_entries FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
  OR EXISTS (
    SELECT 1 FROM public.trade_campaign_lancamentos tcl
    JOIN public.trade_campaigns tc ON tc.id = tcl.campaign_id
    WHERE tcl.id = lancamento_id AND tc.responsible_user_id = auth.uid()
  )
);
