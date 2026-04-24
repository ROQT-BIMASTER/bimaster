-- RPC para diagnóstico de tarefas concluídas sem data_conclusao.
-- SECURITY DEFINER + checagem explícita de admin (has_role) para visão global,
-- contornando RLS sem expor dados a não-admins.

CREATE OR REPLACE FUNCTION public.diag_tarefas_sem_data_conclusao(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  responsavel_id uuid,
  responsavel_nome text,
  responsavel_email text,
  total_concluidas bigint,
  sem_data_conclusao bigint,
  com_data_conclusao bigint,
  pct_sem_data numeric,
  ultima_atualizacao_orfa timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil de administrador';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      t.responsavel_id,
      t.data_conclusao,
      t.updated_at
    FROM public.projeto_tarefas t
    WHERE t.status = 'concluida'
      AND (p_date_from IS NULL OR t.updated_at >= p_date_from)
      AND (p_date_to   IS NULL OR t.updated_at <  p_date_to)
  ),
  agg AS (
    SELECT
      b.responsavel_id,
      COUNT(*)::bigint AS total_concluidas,
      COUNT(*) FILTER (WHERE b.data_conclusao IS NULL)::bigint AS sem_data_conclusao,
      COUNT(*) FILTER (WHERE b.data_conclusao IS NOT NULL)::bigint AS com_data_conclusao,
      MAX(b.updated_at) FILTER (WHERE b.data_conclusao IS NULL) AS ultima_atualizacao_orfa
    FROM base b
    GROUP BY b.responsavel_id
  )
  SELECT
    a.responsavel_id,
    COALESCE(p.nome, '(sem responsável)') AS responsavel_nome,
    COALESCE(p.email, '') AS responsavel_email,
    a.total_concluidas,
    a.sem_data_conclusao,
    a.com_data_conclusao,
    CASE
      WHEN a.total_concluidas = 0 THEN 0
      ELSE ROUND((a.sem_data_conclusao::numeric / a.total_concluidas::numeric) * 100, 2)
    END AS pct_sem_data,
    a.ultima_atualizacao_orfa
  FROM agg a
  LEFT JOIN public.profiles p ON p.id = a.responsavel_id
  ORDER BY a.sem_data_conclusao DESC, a.total_concluidas DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.diag_tarefas_sem_data_conclusao(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diag_tarefas_sem_data_conclusao(timestamptz, timestamptz) TO authenticated;

-- Resumo global (totais + última execução do backfill)
CREATE OR REPLACE FUNCTION public.diag_tarefas_sem_data_conclusao_resumo(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_concluidas bigint,
  sem_data_conclusao bigint,
  com_data_conclusao bigint,
  pct_sem_data numeric,
  responsaveis_afetados bigint,
  ultimo_backfill_em timestamptz,
  ultimo_backfill_rows integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total bigint;
  v_sem bigint;
  v_com bigint;
  v_resp bigint;
  v_last_at timestamptz;
  v_last_rows integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil de administrador';
  END IF;

  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE data_conclusao IS NULL)::bigint,
    COUNT(*) FILTER (WHERE data_conclusao IS NOT NULL)::bigint,
    COUNT(DISTINCT responsavel_id) FILTER (WHERE data_conclusao IS NULL)::bigint
  INTO v_total, v_sem, v_com, v_resp
  FROM public.projeto_tarefas
  WHERE status = 'concluida'
    AND (p_date_from IS NULL OR updated_at >= p_date_from)
    AND (p_date_to   IS NULL OR updated_at <  p_date_to);

  SELECT created_at, rows_updated
  INTO v_last_at, v_last_rows
  FROM public.projeto_tarefas_backfill_log
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN QUERY SELECT
    v_total,
    v_sem,
    v_com,
    CASE WHEN v_total = 0 THEN 0 ELSE ROUND((v_sem::numeric / v_total::numeric) * 100, 2) END,
    v_resp,
    v_last_at,
    v_last_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.diag_tarefas_sem_data_conclusao_resumo(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diag_tarefas_sem_data_conclusao_resumo(timestamptz, timestamptz) TO authenticated;