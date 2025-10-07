
-- Remover todas as políticas existentes e recriar com acesso total

-- PROSPECTS
DROP POLICY IF EXISTS "Todos podem ver prospects" ON public.prospects;
DROP POLICY IF EXISTS "Todos podem atualizar prospects" ON public.prospects;
DROP POLICY IF EXISTS "Todos podem criar prospects" ON public.prospects;
DROP POLICY IF EXISTS "Only supervisors and admins can delete prospects" ON public.prospects;

CREATE POLICY "Acesso total prospects - SELECT"
ON public.prospects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso total prospects - UPDATE"
ON public.prospects FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Acesso total prospects - INSERT"
ON public.prospects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Acesso total prospects - DELETE"
ON public.prospects FOR DELETE TO authenticated USING (true);

-- ATIVIDADES
DROP POLICY IF EXISTS "Todos podem ver atividades" ON public.atividades;
DROP POLICY IF EXISTS "Todos podem criar atividades" ON public.atividades;
DROP POLICY IF EXISTS "Todos podem atualizar atividades" ON public.atividades;

CREATE POLICY "Acesso total atividades - SELECT"
ON public.atividades FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso total atividades - INSERT"
ON public.atividades FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Acesso total atividades - UPDATE"
ON public.atividades FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Acesso total atividades - DELETE"
ON public.atividades FOR DELETE TO authenticated USING (true);

-- PROFILES
DROP POLICY IF EXISTS "Todos podem ver perfis" ON public.profiles;
DROP POLICY IF EXISTS "Todos podem atualizar perfis" ON public.profiles;

CREATE POLICY "Acesso total profiles - SELECT"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso total profiles - UPDATE"
ON public.profiles FOR UPDATE TO authenticated USING (true);

-- USER_ROLES
DROP POLICY IF EXISTS "Todos podem ver roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins podem gerenciar todas as roles" ON public.user_roles;

CREATE POLICY "Acesso total user_roles - SELECT"
ON public.user_roles FOR SELECT TO authenticated USING (true);

-- USUARIO_PERMISSOES_TELAS
DROP POLICY IF EXISTS "Todos podem ver permissões de telas" ON public.usuario_permissoes_telas;
DROP POLICY IF EXISTS "Admins podem gerenciar permissões" ON public.usuario_permissoes_telas;

CREATE POLICY "Acesso total permissoes_telas - SELECT"
ON public.usuario_permissoes_telas FOR SELECT TO authenticated USING (true);

-- USUARIO_PROSPECTS
DROP POLICY IF EXISTS "Todos podem ver vinculações" ON public.usuario_prospects;
DROP POLICY IF EXISTS "Admins e supervisores podem gerenciar vinculações" ON public.usuario_prospects;

CREATE POLICY "Acesso total usuario_prospects - SELECT"
ON public.usuario_prospects FOR SELECT TO authenticated USING (true);

-- MUNICIPIOS_USUARIOS
DROP POLICY IF EXISTS "Todos podem ver vínculos de municípios" ON public.municipios_usuarios;
DROP POLICY IF EXISTS "Admins podem gerenciar vínculos" ON public.municipios_usuarios;

CREATE POLICY "Acesso total municipios_usuarios - SELECT"
ON public.municipios_usuarios FOR SELECT TO authenticated USING (true);
