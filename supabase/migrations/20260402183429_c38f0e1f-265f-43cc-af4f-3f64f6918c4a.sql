CREATE OR REPLACE FUNCTION public.get_projetos_member_avatars()
RETURNS TABLE(projeto_id uuid, user_id uuid, nome text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (pm.projeto_id, pm.user_id)
    pm.projeto_id,
    pm.user_id,
    p.nome,
    p.avatar_url
  FROM projeto_membros pm
  JOIN profiles p ON p.id = pm.user_id
  ORDER BY pm.projeto_id, pm.user_id
$$;