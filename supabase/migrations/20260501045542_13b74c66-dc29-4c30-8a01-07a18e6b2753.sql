-- =============================================================
-- Phase 1: Tighten RLS on flagged tables
-- =============================================================

-- 1.1 product_comparisons --------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view product_comparisons" ON public.product_comparisons;
DROP POLICY IF EXISTS "Usuários podem ver comparações" ON public.product_comparisons;
DROP POLICY IF EXISTS "Auth users read product_comparisons" ON public.product_comparisons;

CREATE POLICY "Auth users read product_comparisons"
ON public.product_comparisons
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_admin_or_supervisor(auth.uid())
);

-- Reescopa INSERT/UPDATE/DELETE de {public} para {authenticated}
DROP POLICY IF EXISTS "Usuários podem criar comparações" ON public.product_comparisons;
CREATE POLICY "Auth users insert product_comparisons"
ON public.product_comparisons
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Criadores podem atualizar comparações" ON public.product_comparisons;
CREATE POLICY "Owners or admins update product_comparisons"
ON public.product_comparisons
FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.is_admin_or_supervisor(auth.uid()))
WITH CHECK (created_by = auth.uid() OR public.is_admin_or_supervisor(auth.uid()));

DROP POLICY IF EXISTS "Admins podem deletar comparações" ON public.product_comparisons;
CREATE POLICY "Admins delete product_comparisons"
ON public.product_comparisons
FOR DELETE TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));

-- 1.2 social_media_metrics_history ----------------------------
DROP POLICY IF EXISTS "Authenticated users can view social media metrics" ON public.social_media_metrics_history;
DROP POLICY IF EXISTS "Users can view their account metrics history" ON public.social_media_metrics_history;
DROP POLICY IF EXISTS "Users read own account metrics history" ON public.social_media_metrics_history;

CREATE POLICY "Users read own account metrics history"
ON public.social_media_metrics_history
FOR SELECT TO authenticated
USING (
  account_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.social_media_accounts sma
    WHERE sma.id = social_media_metrics_history.account_id
      AND sma.user_id = auth.uid()
  )
);

-- 1.3 global_rate_limit_buckets -------------------------------
DROP POLICY IF EXISTS "Service role only" ON public.global_rate_limit_buckets;
CREATE POLICY "Service role only"
ON public.global_rate_limit_buckets
FOR ALL TO service_role
USING (true) WITH CHECK (true);
