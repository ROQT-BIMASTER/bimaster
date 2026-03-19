
ALTER TABLE portadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view portadores of their empresas"
ON portadores FOR SELECT TO authenticated
USING (public.user_has_empresa_access(auth.uid(), empresa_id));

CREATE POLICY "Admins can manage portadores"
ON portadores FOR ALL TO authenticated
USING (public.is_admin_or_supervisor(auth.uid()));
