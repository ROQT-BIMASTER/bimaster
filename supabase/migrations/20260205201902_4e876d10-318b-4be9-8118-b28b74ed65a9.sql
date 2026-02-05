
-- Fix: has_role() should treat 'gerente' as also having 'supervisor' level access
-- This automatically fixes ALL 50+ RLS policies that check has_role(uid, 'supervisor')
-- without needing to update each policy individually.
CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND (
      role = _role 
      OR (_role = 'supervisor' AND role = 'gerente')
    )
  )
$$;
