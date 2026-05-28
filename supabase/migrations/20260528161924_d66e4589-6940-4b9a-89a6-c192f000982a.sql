CREATE OR REPLACE FUNCTION public.rpc_audit_usuarios_resumo(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  user_nome text,
  total_acessos bigint,
  acessos_24h bigint,
  ultimo_acesso timestamptz,
  telas_distintas bigint,
  modulos_distintos bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.user_id,
    COALESCE(p.nome, 'Desconhecido') AS user_nome,
    COUNT(*)::bigint AS total_acessos,
    COUNT(*) FILTER (WHERE a.created_at >= now() - interval '24 hours')::bigint AS acessos_24h,
    MAX(a.created_at) AS ultimo_acesso,
    COUNT(DISTINCT a.tela_codigo)::bigint AS telas_distintas,
    COUNT(DISTINCT a.modulo_codigo)::bigint AS modulos_distintos
  FROM public.access_audit_log a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id IS NOT NULL
    AND (p_from IS NULL OR a.created_at >= p_from)
    AND (p_to IS NULL OR a.created_at <= p_to)
    AND public.has_role(auth.uid(), 'admin'::app_role)
  GROUP BY a.user_id, p.nome
  ORDER BY MAX(a.created_at) DESC;
$$;

REVOKE ALL ON FUNCTION public.rpc_audit_usuarios_resumo(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_audit_usuarios_resumo(timestamptz, timestamptz) TO authenticated;