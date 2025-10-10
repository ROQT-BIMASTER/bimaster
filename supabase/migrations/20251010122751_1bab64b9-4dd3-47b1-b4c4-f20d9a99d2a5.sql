-- Permitir admins gerenciarem roles
CREATE POLICY "Admins podem gerenciar user_roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Permitir admins e supervisores gerenciarem permissões de telas
CREATE POLICY "Admins e supervisores podem gerenciar permissões_telas - INSERT"
ON public.usuario_permissoes_telas
FOR INSERT
WITH CHECK (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem gerenciar permissoes_telas - UPDATE"
ON public.usuario_permissoes_telas
FOR UPDATE
USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem gerenciar permissoes_telas - DELETE"
ON public.usuario_permissoes_telas
FOR DELETE
USING (is_admin_or_supervisor(auth.uid()));

-- Permitir admins e supervisores gerenciarem vinculações de municípios
CREATE POLICY "Admins e supervisores podem gerenciar municipios_usuarios - INSERT"
ON public.municipios_usuarios
FOR INSERT
WITH CHECK (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem gerenciar municipios_usuarios - UPDATE"
ON public.municipios_usuarios
FOR UPDATE
USING (is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins e supervisores podem gerenciar municipios_usuarios - DELETE"
ON public.municipios_usuarios
FOR DELETE
USING (is_admin_or_supervisor(auth.uid()));