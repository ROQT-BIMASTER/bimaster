CREATE OR REPLACE FUNCTION public.get_projeto_membros_directory(_projeto_id uuid)
RETURNS TABLE (id uuid, nome text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.avatar_url
  FROM public.projeto_membros m
  JOIN public.profiles p ON p.id = m.user_id
  WHERE m.projeto_id = _projeto_id
    AND public.user_can_access_projeto(auth.uid(), _projeto_id)
    AND COALESCE(p.status, 'ativo') = 'ativo'
    AND COALESCE(p.is_honeytoken, false) = false;
$$;

REVOKE ALL ON FUNCTION public.get_projeto_membros_directory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_projeto_membros_directory(uuid) TO authenticated;