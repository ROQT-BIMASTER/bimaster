-- ============== api_support_messages.admin_update ==============
DROP POLICY IF EXISTS "admin_update" ON public.api_support_messages;
CREATE POLICY "support_messages_admin_update"
ON public.api_support_messages FOR UPDATE TO authenticated
USING (is_admin_or_supervisor(auth.uid()))
WITH CHECK (is_admin_or_supervisor(auth.uid()));

-- ============== documento_anexos — empresa-scoped ==============
DROP POLICY IF EXISTS "Authenticated users can manage own empresa anexos" ON public.documento_anexos;

CREATE POLICY "documento_anexos_select_empresa_scoped"
ON public.documento_anexos FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR empresa_id IN (SELECT (ue.empresa_id)::text FROM user_empresas ue WHERE ue.user_id = auth.uid())
);

CREATE POLICY "documento_anexos_insert_empresa_scoped"
ON public.documento_anexos FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR empresa_id IN (SELECT (ue.empresa_id)::text FROM user_empresas ue WHERE ue.user_id = auth.uid())
);

CREATE POLICY "documento_anexos_update_empresa_scoped"
ON public.documento_anexos FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR empresa_id IN (SELECT (ue.empresa_id)::text FROM user_empresas ue WHERE ue.user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR empresa_id IN (SELECT (ue.empresa_id)::text FROM user_empresas ue WHERE ue.user_id = auth.uid())
);

CREATE POLICY "documento_anexos_delete_empresa_scoped"
ON public.documento_anexos FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR empresa_id IN (SELECT (ue.empresa_id)::text FROM user_empresas ue WHERE ue.user_id = auth.uid())
);