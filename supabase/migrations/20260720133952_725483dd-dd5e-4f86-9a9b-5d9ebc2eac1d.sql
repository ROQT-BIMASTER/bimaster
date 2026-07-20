ALTER VIEW public.vw_estoque_unificado_skus SET (security_invoker = true);
ALTER VIEW public.vw_bom_path SET (security_invoker = true);
ALTER VIEW public.vw_capacidade_montagem SET (security_invoker = true);
ALTER VIEW public.vw_bom_ativa SET (security_invoker = true);

DROP POLICY IF EXISTS ur_select ON public.user_roles;
CREATE POLICY ur_select ON public.user_roles
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR public.is_supervisor_of((SELECT auth.uid()), user_id)
);