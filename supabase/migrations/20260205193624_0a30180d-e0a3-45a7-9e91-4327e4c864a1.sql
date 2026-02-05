
CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id uuid, target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_role app_role;
  is_direct_subordinate boolean;
BEGIN
  -- Users can always see their own profile
  IF viewer_id = target_profile_id THEN
    RETURN true;
  END IF;
  
  -- Get the viewer's role
  SELECT role INTO viewer_role
  FROM user_roles
  WHERE user_id = viewer_id
  LIMIT 1;
  
  -- Only admins can see all profiles
  IF viewer_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Supervisors can only see their DIRECT subordinates
  -- FIX: supervisor_id is in profiles table, not user_roles
  IF viewer_role = 'supervisor' THEN
    SELECT EXISTS(
      SELECT 1 FROM profiles
      WHERE id = target_profile_id
      AND supervisor_id = viewer_id
    ) INTO is_direct_subordinate;
    
    RETURN is_direct_subordinate;
  END IF;
  
  -- All other users can only see their own profile (handled above)
  RETURN false;
END;
$$;
