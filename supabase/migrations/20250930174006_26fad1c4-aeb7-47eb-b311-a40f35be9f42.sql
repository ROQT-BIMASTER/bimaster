-- Remover políticas problemáticas da tabela profiles
DROP POLICY IF EXISTS "Supervisors can view their team" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Criar função segura para verificar se é supervisor/admin
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id
    AND tipo_usuario IN ('admin', 'supervisor')
  );
$$;

-- Política para usuários visualizarem seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Política para usuários atualizarem seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Política para admins e supervisores visualizarem todos os perfis
CREATE POLICY "Admins and supervisors view all"
  ON public.profiles
  FOR SELECT
  USING (
    public.is_admin_or_supervisor(auth.uid())
  );

-- Política para admins e supervisores atualizarem perfis
CREATE POLICY "Admins and supervisors update all"
  ON public.profiles
  FOR UPDATE
  USING (
    public.is_admin_or_supervisor(auth.uid())
  );