
-- Atualizar políticas RLS para permitir acesso total por padrão

-- Prospects: todos podem ver todos os prospects
DROP POLICY IF EXISTS "Vendedores can view their own prospects" ON public.prospects;
CREATE POLICY "Todos podem ver prospects"
ON public.prospects
FOR SELECT
TO authenticated
USING (true);

-- Prospects: todos podem atualizar
DROP POLICY IF EXISTS "Vendedores can update their own prospects" ON public.prospects;
CREATE POLICY "Todos podem atualizar prospects"
ON public.prospects
FOR UPDATE
TO authenticated
USING (true);

-- Prospects: todos podem criar
DROP POLICY IF EXISTS "Vendedores can create prospects" ON public.prospects;
CREATE POLICY "Todos podem criar prospects"
ON public.prospects
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Atividades: todos podem ver
DROP POLICY IF EXISTS "Users can view activities for their prospects" ON public.atividades;
CREATE POLICY "Todos podem ver atividades"
ON public.atividades
FOR SELECT
TO authenticated
USING (true);

-- Atividades: todos podem criar
DROP POLICY IF EXISTS "Users can create activities" ON public.atividades;
CREATE POLICY "Todos podem criar atividades"
ON public.atividades
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Atividades: todos podem atualizar
DROP POLICY IF EXISTS "Users can update their own activities" ON public.atividades;
CREATE POLICY "Todos podem atualizar atividades"
ON public.atividades
FOR UPDATE
TO authenticated
USING (true);

-- Profiles: todos podem ver todos os perfis
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and supervisors view all" ON public.profiles;
CREATE POLICY "Todos podem ver perfis"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Profiles: todos podem atualizar todos os perfis
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and supervisors update all" ON public.profiles;
CREATE POLICY "Todos podem atualizar perfis"
ON public.profiles
FOR UPDATE
TO authenticated
USING (true);

-- User roles: todos podem ver roles
DROP POLICY IF EXISTS "Usuários podem ver suas próprias roles" ON public.user_roles;
CREATE POLICY "Todos podem ver roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Permissões de telas: todos podem ver
DROP POLICY IF EXISTS "Usuários podem ver suas próprias permissões" ON public.usuario_permissoes_telas;
CREATE POLICY "Todos podem ver permissões de telas"
ON public.usuario_permissoes_telas
FOR SELECT
TO authenticated
USING (true);

-- Vínculos usuário-prospects: todos podem ver
DROP POLICY IF EXISTS "Usuários podem ver suas vinculações" ON public.usuario_prospects;
CREATE POLICY "Todos podem ver vinculações"
ON public.usuario_prospects
FOR SELECT
TO authenticated
USING (true);

-- Municípios usuários: todos podem ver
DROP POLICY IF EXISTS "Vendedores podem ver seus próprios vínculos" ON public.municipios_usuarios;
DROP POLICY IF EXISTS "Admins e supervisores podem ver todos os vínculos" ON public.municipios_usuarios;
CREATE POLICY "Todos podem ver vínculos de municípios"
ON public.municipios_usuarios
FOR SELECT
TO authenticated
USING (true);
