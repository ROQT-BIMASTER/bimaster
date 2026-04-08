-- 1. marketing_user_stats: restringir a authenticated
DROP POLICY IF EXISTS "Users can view all stats" ON public.marketing_user_stats;
CREATE POLICY "Authenticated users can view stats"
  ON public.marketing_user_stats FOR SELECT TO authenticated USING (true);

-- 2. products: remover policy genérica permissiva (products_select_restricted já cobre)
DROP POLICY IF EXISTS "Usuários autenticados podem ver produtos" ON public.products;