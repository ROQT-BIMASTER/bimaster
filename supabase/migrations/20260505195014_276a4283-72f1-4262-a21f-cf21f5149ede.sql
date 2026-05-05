
-- Fix: policies referenced module code 'fabrica_china' which doesn't exist in modulos_sistema (only 'china' exists)
-- This caused delete actions to fail silently for non-admin users with china module access.

DROP POLICY IF EXISTS "Users with china access can delete document links" ON public.china_documento_tarefa_vinculos;
CREATE POLICY "Users with china access can delete document links"
ON public.china_documento_tarefa_vinculos
FOR DELETE
TO authenticated
USING (
  public.check_user_access(auth.uid(), 'china')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

DROP POLICY IF EXISTS "china_pasta_delete" ON public.china_pasta_digital;
CREATE POLICY "china_pasta_delete"
ON public.china_pasta_digital
FOR DELETE
TO authenticated
USING (
  public.check_user_access(auth.uid(), 'china')
  OR created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
);

DROP POLICY IF EXISTS "cstv_delete" ON public.china_submissao_tarefa_vinculos;
CREATE POLICY "cstv_delete"
ON public.china_submissao_tarefa_vinculos
FOR DELETE
TO authenticated
USING (
  public.check_user_access(auth.uid(), 'china')
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
);
