CREATE OR REPLACE FUNCTION public.get_chat_directory(_ids uuid[] DEFAULT NULL)
RETURNS TABLE (id uuid, nome text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.avatar_url
  FROM public.profiles p
  WHERE COALESCE(p.status, 'ativo') = 'ativo'
    AND COALESCE(p.is_honeytoken, false) = false
    AND (_ids IS NULL OR p.id = ANY (_ids))
  ORDER BY p.nome;
$$;

REVOKE EXECUTE ON FUNCTION public.get_chat_directory(uuid[]) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_chat_directory(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.get_chat_directory(uuid[]) IS 'Diretório corporativo (id, nome, avatar_url de ativos não-honeytoken). SECURITY DEFINER substitui a view chat_directory. _ids NULL = empresa toda; preenchido = subconjunto por id. Sem email/PII.';
COMMENT ON VIEW public.chat_directory IS 'DEPRECADA: prefira public.get_chat_directory().';