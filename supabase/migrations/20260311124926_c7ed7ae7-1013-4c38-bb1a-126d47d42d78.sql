CREATE OR REPLACE FUNCTION public.get_subordinados(_user_id uuid)
RETURNS TABLE(subordinado_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE hierarchy AS (
    SELECT id
    FROM public.profiles
    WHERE supervisor_id = _user_id
    
    UNION ALL
    
    SELECT p.id
    FROM public.profiles p
    INNER JOIN hierarchy h ON p.supervisor_id = h.id
  )
  SELECT id FROM hierarchy;
END;
$$;