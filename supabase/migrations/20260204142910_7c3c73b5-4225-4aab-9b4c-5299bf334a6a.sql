
-- Adicionar política para permitir que admins atualizem perfis de outros usuários
-- Primeiro, criar função auxiliar se não existir
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Adicionar política de UPDATE para admins
CREATE POLICY "profiles_update_by_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
