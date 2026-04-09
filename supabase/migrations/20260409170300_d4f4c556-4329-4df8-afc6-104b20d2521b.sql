-- Drop policies that may have been partially created
DROP POLICY IF EXISTS "trade_campaign_expenses_select_restricted" ON public.trade_campaign_expenses;
DROP POLICY IF EXISTS "trade_campaign_products_select_restricted" ON public.trade_campaign_products;
DROP POLICY IF EXISTS "trade_campaign_sellout_entries_select_restricted" ON public.trade_campaign_sellout_entries;
DROP POLICY IF EXISTS "china_produto_submissoes_select_restricted" ON public.china_produto_submissoes;

-- Also drop any remaining permissive policies
DROP POLICY IF EXISTS "trade_campaign_expenses_select" ON public.trade_campaign_expenses;
DROP POLICY IF EXISTS "Authenticated users can view campaign expenses" ON public.trade_campaign_expenses;
DROP POLICY IF EXISTS "Users can view all campaign expenses" ON public.trade_campaign_expenses;

DROP POLICY IF EXISTS "trade_campaign_products_select" ON public.trade_campaign_products;
DROP POLICY IF EXISTS "Authenticated users can view campaign products" ON public.trade_campaign_products;
DROP POLICY IF EXISTS "Users can view all campaign products" ON public.trade_campaign_products;

DROP POLICY IF EXISTS "trade_campaign_sellout_entries_select" ON public.trade_campaign_sellout_entries;
DROP POLICY IF EXISTS "Authenticated users can view sellout entries" ON public.trade_campaign_sellout_entries;
DROP POLICY IF EXISTS "Users can view all sellout entries" ON public.trade_campaign_sellout_entries;

DROP POLICY IF EXISTS "china_produto_submissoes_select" ON public.china_produto_submissoes;
DROP POLICY IF EXISTS "Authenticated users can view submissions" ON public.china_produto_submissoes;
DROP POLICY IF EXISTS "Users can view all submissions" ON public.china_produto_submissoes;
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.china_produto_submissoes;

-- Recreate restricted policies
CREATE POLICY "trade_campaign_expenses_select_restricted"
ON public.trade_campaign_expenses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trade_campaigns tc
    WHERE tc.id = trade_campaign_expenses.campaign_id
      AND (tc.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
  )
);

CREATE POLICY "trade_campaign_products_select_restricted"
ON public.trade_campaign_products FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trade_campaigns tc
    WHERE tc.id = trade_campaign_products.campaign_id
      AND (tc.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
  )
);

CREATE POLICY "trade_campaign_sellout_entries_select_restricted"
ON public.trade_campaign_sellout_entries FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trade_campaigns tc
    WHERE tc.id = trade_campaign_sellout_entries.campaign_id
      AND (tc.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'supervisor'))
  )
);

CREATE POLICY "china_produto_submissoes_select_restricted"
ON public.china_produto_submissoes FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'supervisor')
);