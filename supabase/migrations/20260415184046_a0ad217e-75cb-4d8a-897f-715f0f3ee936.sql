
DROP POLICY IF EXISTS "fabrica_custos_delete_admin_only" ON public.fabrica_produto_custos;
CREATE POLICY "fabrica_custos_delete_restricted"
  ON public.fabrica_produto_custos FOR DELETE
  TO authenticated
  USING (public.can_access_fabrica(auth.uid()));

DROP POLICY IF EXISTS "fabrica_config_delete_admin_only" ON public.fabrica_produto_custos_config;
CREATE POLICY "fabrica_config_delete_restricted"
  ON public.fabrica_produto_custos_config FOR DELETE
  TO authenticated
  USING (public.can_access_fabrica(auth.uid()));
