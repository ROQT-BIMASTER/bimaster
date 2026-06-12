
CREATE OR REPLACE FUNCTION public.rpc_listar_projetos_para_vinculo(p_termo text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS TABLE (id uuid, nome text, status text, tipo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.status::text, p.tipo::text
  FROM public.projetos p
  WHERE p.deleted_at IS NULL
    AND public.user_can_access_projeto(auth.uid(), p.id)
    AND (p_termo IS NULL OR p_termo = '' OR p.nome ILIKE '%' || p_termo || '%')
  ORDER BY p.nome
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.rpc_listar_projetos_para_vinculo(text, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_listar_projetos_para_vinculo(text, int) FROM anon, PUBLIC;
