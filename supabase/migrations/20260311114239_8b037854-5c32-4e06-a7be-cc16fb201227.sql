
-- Fix is_admin_or_supervisor search_path so it works correctly within RLS context
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role IN ('admin', 'supervisor', 'gerente')
  )
$$;

-- Also fix user_has_empresa_access to ensure it references public schema explicitly
CREATE OR REPLACE FUNCTION public.user_has_empresa_access(_user_id uuid, _empresa_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    _empresa_id IS NULL OR
    public.is_admin_or_supervisor(_user_id) OR
    EXISTS (
      SELECT 1 FROM public.user_empresas 
      WHERE user_id = _user_id AND empresa_id = _empresa_id
    )
$$;
