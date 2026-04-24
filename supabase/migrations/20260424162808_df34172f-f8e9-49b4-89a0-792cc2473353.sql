-- Corrige PR-55: a tabela usa `executed_at`, não `created_at`.
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

  SELECT executed_at, rows_updated
  INTO v_last_at, v_last_rows
  FROM public.projeto_tarefas_backfill_log
  ORDER BY executed_at DESC
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

-- Lista paginada do log
CREATE OR REPLACE FUNCTION public.diag_backfill_log_listar(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_source    text        DEFAULT NULL,
  p_limit     integer     DEFAULT 200
)
RETURNS TABLE (
  id uuid,
  executed_at timestamptz,
  source text,
  rows_updated integer,
  duration_ms integer,
  details jsonb
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
  SELECT
    l.id,
    l.executed_at,
    l.source,
    l.rows_updated,
    l.duration_ms,
    l.details
  FROM public.projeto_tarefas_backfill_log l
  WHERE (p_date_from IS NULL OR l.executed_at >= p_date_from)
    AND (p_date_to   IS NULL OR l.executed_at <  p_date_to)
    AND (p_source    IS NULL OR l.source = p_source)
  ORDER BY l.executed_at DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 200), 1000), 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.diag_backfill_log_listar(timestamptz, timestamptz, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diag_backfill_log_listar(timestamptz, timestamptz, text, integer) TO authenticated;

-- Resumo agregado do log
CREATE OR REPLACE FUNCTION public.diag_backfill_log_resumo(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  total_execucoes bigint,
  total_tarefas_corrigidas bigint,
  execucoes_com_correcao bigint,
  execucoes_sem_correcao bigint,
  duracao_media_ms numeric,
  duracao_maxima_ms integer,
  primeira_execucao timestamptz,
  ultima_execucao timestamptz,
  por_origem jsonb
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
    SELECT *
    FROM public.projeto_tarefas_backfill_log
    WHERE (p_date_from IS NULL OR executed_at >= p_date_from)
      AND (p_date_to   IS NULL OR executed_at <  p_date_to)
  ),
  por_src AS (
    SELECT source,
           COUNT(*)::bigint AS execucoes,
           COALESCE(SUM(rows_updated), 0)::bigint AS rows_updated
    FROM base
    GROUP BY source
  ),
  por_src_json AS (
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object(
        'source', source,
        'execucoes', execucoes,
        'rows_updated', rows_updated
      ) ORDER BY execucoes DESC),
      '[]'::jsonb
    ) AS j
    FROM por_src
  )
  SELECT
    COUNT(*)::bigint,
    COALESCE(SUM(rows_updated), 0)::bigint,
    COUNT(*) FILTER (WHERE rows_updated > 0)::bigint,
    COUNT(*) FILTER (WHERE rows_updated = 0)::bigint,
    COALESCE(ROUND(AVG(duration_ms)::numeric, 2), 0),
    COALESCE(MAX(duration_ms), 0),
    MIN(executed_at),
    MAX(executed_at),
    (SELECT j FROM por_src_json)
  FROM base;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.diag_backfill_log_resumo(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diag_backfill_log_resumo(timestamptz, timestamptz) TO authenticated;