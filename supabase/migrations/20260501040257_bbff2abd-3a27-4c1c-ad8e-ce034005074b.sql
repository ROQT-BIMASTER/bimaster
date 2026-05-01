-- 1) our_products: restringir SELECT a authenticated
DROP POLICY IF EXISTS "Usuários podem ver produtos" ON public.our_products;

CREATE POLICY "Authenticated users can view our_products"
ON public.our_products
FOR SELECT
TO authenticated
USING (true);

-- 2) product_comparisons: restringir SELECT a authenticated
DROP POLICY IF EXISTS "Usuários podem ver comparações" ON public.product_comparisons;

CREATE POLICY "Authenticated users can view product_comparisons"
ON public.product_comparisons
FOR SELECT
TO authenticated
USING (true);

-- 3) social_media_metrics_history: remover policy ampla USING(true)
DROP POLICY IF EXISTS "Authenticated users can view social media metrics" ON public.social_media_metrics_history;
-- mantém a policy escopada por conta já existente
