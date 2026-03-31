
DROP POLICY IF EXISTS "Usuários autenticados podem ver redes ativas" ON public.store_chains;
CREATE POLICY "Authenticated users can view active chains"
  ON public.store_chains FOR SELECT TO authenticated
  USING (active = true);
