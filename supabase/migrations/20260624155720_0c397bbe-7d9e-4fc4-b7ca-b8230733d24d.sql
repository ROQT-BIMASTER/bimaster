CREATE OR REPLACE FUNCTION public.rpc_canary_submissao_projeto_unicidade()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_dup int;
  v_idx boolean;
BEGIN
  SELECT count(*) INTO v_dup
  FROM (
    SELECT submissao_id
    FROM public.china_submissao_projetos
    GROUP BY submissao_id
    HAVING count(*) > 1
  ) s;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'china_submissao_projetos'
      AND indexname = 'china_submissao_projetos_submissao_id_uniq'
  ) INTO v_idx;

  RETURN jsonb_build_object(
    'duplicates', v_dup,
    'unique_index_present', v_idx,
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_canary_submissao_projeto_unicidade() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_canary_submissao_projeto_unicidade() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.rpc_canary_submissao_projeto_unicidade() IS
  'Canary read-only da unificação Submissão↔Projeto (Fase 8). Retorna apenas contadores agregados, sem PII. Usado por scripts/security/canary-submissao-projeto.sh no CI.';