
-- ============================================================================
-- PR-58 (v3.4.22): Checagem semanal automatizada de consistência de
-- data_conclusao em tarefas concluídas, com abertura de incidente em
-- security_incidents quando houver inconsistências.
-- ============================================================================

-- 1) Tabela de log das execuções da checagem semanal
CREATE TABLE IF NOT EXISTS public.projeto_tarefas_consistency_check_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  source text NOT NULL DEFAULT 'cron',
  total_concluidas integer NOT NULL DEFAULT 0,
  com_data_conclusao integer NOT NULL DEFAULT 0,
  sem_data_conclusao integer NOT NULL DEFAULT 0,
  inconsistency_pct numeric(5,2) NOT NULL DEFAULT 0,
  incident_opened boolean NOT NULL DEFAULT false,
  incident_id uuid,
  details jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_consistency_check_log_executed_at
  ON public.projeto_tarefas_consistency_check_log (executed_at DESC);

ALTER TABLE public.projeto_tarefas_consistency_check_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read consistency log"
  ON public.projeto_tarefas_consistency_check_log;
CREATE POLICY "Admins can read consistency log"
  ON public.projeto_tarefas_consistency_check_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Apenas o backend (SECURITY DEFINER) escreve; nenhum usuário tem INSERT/UPDATE/DELETE.

-- 2) Função principal: roda a checagem, registra no log e abre incidente se necessário
CREATE OR REPLACE FUNCTION public.consistency_check_tarefas_data_conclusao(
  p_source text DEFAULT 'cron'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_started_at      timestamptz := clock_timestamp();
  v_total           integer := 0;
  v_com             integer := 0;
  v_sem             integer := 0;
  v_pct             numeric(5,2) := 0;
  v_log_id          uuid;
  v_incident_id     uuid;
  v_open_incident   boolean := false;
  v_severity        text;
  v_top_offenders   jsonb;
BEGIN
  -- Conta totais
  SELECT
    COUNT(*) FILTER (WHERE status = 'concluida'),
    COUNT(*) FILTER (WHERE status = 'concluida' AND data_conclusao IS NOT NULL),
    COUNT(*) FILTER (WHERE status = 'concluida' AND data_conclusao IS NULL)
  INTO v_total, v_com, v_sem
  FROM public.projeto_tarefas;

  IF v_total > 0 THEN
    v_pct := ROUND((v_sem::numeric / v_total::numeric) * 100, 2);
  END IF;

  -- Decide se abre incidente
  -- Critério: qualquer tarefa concluída sem data_conclusao é uma inconsistência
  IF v_sem > 0 THEN
    v_open_incident := true;

    -- Severidade proporcional ao volume
    IF v_sem >= 100 OR v_pct >= 5 THEN
      v_severity := 'high';
    ELSIF v_sem >= 20 OR v_pct >= 1 THEN
      v_severity := 'medium';
    ELSE
      v_severity := 'low';
    END IF;

    -- Top 5 responsáveis com mais órfãs (para anexar ao incidente)
    SELECT COALESCE(jsonb_agg(t ORDER BY t.orfas DESC), '[]'::jsonb)
    INTO v_top_offenders
    FROM (
      SELECT
        responsavel_id,
        COUNT(*)::int AS orfas
      FROM public.projeto_tarefas
      WHERE status = 'concluida' AND data_conclusao IS NULL
      GROUP BY responsavel_id
      ORDER BY COUNT(*) DESC
      LIMIT 5
    ) t;

    -- Evita duplicar incidentes ainda abertos para o mesmo tipo
    SELECT id INTO v_incident_id
    FROM public.security_incidents
    WHERE incident_type = 'task_data_conclusao_inconsistency'
      AND status NOT IN ('resolved', 'mitigated')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_incident_id IS NULL THEN
      INSERT INTO public.security_incidents (
        incident_type,
        severity,
        status,
        title,
        description,
        detection_method,
        confidence_score,
        auto_action_taken,
        related_events
      ) VALUES (
        'task_data_conclusao_inconsistency',
        v_severity,
        'open',
        'Tarefas concluídas sem data_conclusao detectadas',
        format(
          'Checagem semanal encontrou %s tarefa(s) concluída(s) sem data_conclusao (%s%% do total de %s concluídas). Origem: %s.',
          v_sem, v_pct, v_total, p_source
        ),
        'consistency_check',
        1.00,
        'none',
        jsonb_build_object(
          'check_source', p_source,
          'total_concluidas', v_total,
          'com_data_conclusao', v_com,
          'sem_data_conclusao', v_sem,
          'inconsistency_pct', v_pct,
          'top_offenders', v_top_offenders
        )
      )
      RETURNING id INTO v_incident_id;
    ELSE
      -- Atualiza incidente aberto com a leitura mais recente
      UPDATE public.security_incidents
      SET
        severity = v_severity,
        description = format(
          'Atualizado: %s tarefa(s) concluída(s) sem data_conclusao (%s%% de %s). Última checagem: %s. Origem: %s.',
          v_sem, v_pct, v_total, now(), p_source
        ),
        related_events = COALESCE(related_events, '{}'::jsonb) || jsonb_build_object(
          'last_check_at', now(),
          'last_check_source', p_source,
          'total_concluidas', v_total,
          'com_data_conclusao', v_com,
          'sem_data_conclusao', v_sem,
          'inconsistency_pct', v_pct,
          'top_offenders', v_top_offenders
        ),
        updated_at = now()
      WHERE id = v_incident_id;
    END IF;
  ELSE
    -- Sem inconsistências: se houver incidente aberto, marca como resolvido
    UPDATE public.security_incidents
    SET
      status = 'resolved',
      resolved_at = now(),
      notes = COALESCE(notes, '') || E'\nResolvido automaticamente pela checagem semanal em ' || now()::text,
      updated_at = now()
    WHERE incident_type = 'task_data_conclusao_inconsistency'
      AND status NOT IN ('resolved', 'mitigated');
  END IF;

  -- Log da execução
  INSERT INTO public.projeto_tarefas_consistency_check_log (
    duration_ms,
    source,
    total_concluidas,
    com_data_conclusao,
    sem_data_conclusao,
    inconsistency_pct,
    incident_opened,
    incident_id,
    details
  ) VALUES (
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::int,
    p_source,
    v_total,
    v_com,
    v_sem,
    v_pct,
    v_open_incident,
    v_incident_id,
    jsonb_build_object(
      'severity', v_severity,
      'top_offenders', v_top_offenders
    )
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

-- 3) RPC admin: executar manualmente (botão "Executar agora")
CREATE OR REPLACE FUNCTION public.consistency_check_tarefas_run_now()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar a checagem.';
  END IF;
  RETURN public.consistency_check_tarefas_data_conclusao('manual');
END;
$function$;

-- 4) RPC admin: listar histórico
CREATE OR REPLACE FUNCTION public.consistency_check_tarefas_listar(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_limit     integer     DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  executed_at timestamptz,
  duration_ms integer,
  source text,
  total_concluidas integer,
  com_data_conclusao integer,
  sem_data_conclusao integer,
  inconsistency_pct numeric,
  incident_opened boolean,
  incident_id uuid,
  details jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.executed_at, l.duration_ms, l.source,
    l.total_concluidas, l.com_data_conclusao, l.sem_data_conclusao,
    l.inconsistency_pct, l.incident_opened, l.incident_id, l.details
  FROM public.projeto_tarefas_consistency_check_log l
  WHERE (p_date_from IS NULL OR l.executed_at >= p_date_from)
    AND (p_date_to   IS NULL OR l.executed_at <= p_date_to)
  ORDER BY l.executed_at DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 100), 1000), 10);
END;
$function$;

-- 5) RPC admin: KPIs de resumo
CREATE OR REPLACE FUNCTION public.consistency_check_tarefas_resumo()
RETURNS TABLE (
  total_execucoes integer,
  ultima_execucao timestamptz,
  ultima_total_concluidas integer,
  ultima_sem_data_conclusao integer,
  ultima_inconsistency_pct numeric,
  ultima_incident_id uuid,
  incidentes_abertos integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  SELECT * INTO v_last
  FROM public.projeto_tarefas_consistency_check_log
  ORDER BY executed_at DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::int FROM public.projeto_tarefas_consistency_check_log),
    v_last.executed_at,
    v_last.total_concluidas,
    v_last.sem_data_conclusao,
    v_last.inconsistency_pct,
    v_last.incident_id,
    (SELECT COUNT(*)::int FROM public.security_incidents
       WHERE incident_type = 'task_data_conclusao_inconsistency'
         AND status NOT IN ('resolved', 'mitigated'));
END;
$function$;
