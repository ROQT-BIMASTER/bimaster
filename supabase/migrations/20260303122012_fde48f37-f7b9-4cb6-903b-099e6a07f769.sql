
CREATE POLICY "stores_select_access" ON public.stores
FOR SELECT TO authenticated
USING (
  check_user_access(auth.uid())
  OR vendedor_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.store_sellers ss
    WHERE ss.store_id = stores.id AND ss.vendedor_id = auth.uid()
  )
);
