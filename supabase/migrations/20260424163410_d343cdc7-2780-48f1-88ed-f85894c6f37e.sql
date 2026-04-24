-- =====================================================================
-- 1. CONFIG TABLE (single row enforced via unique partial index)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefas_backfill_alert_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT true,
  threshold_orfas integer NOT NULL DEFAULT 50 CHECK (threshold_orfas >= 0),
  cooldown_minutes integer NOT NULL DEFAULT 360 CHECK (cooldown_minutes >= 0),
  notify_admins boolean NOT NULL DEFAULT true,
  extra_recipient_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Single-row guard
CREATE UNIQUE INDEX IF NOT EXISTS projeto_tarefas_backfill_alert_config_singleton
  ON public.projeto_tarefas_backfill_alert_config ((true));

-- Seed default row if empty
INSERT INTO public.projeto_tarefas_backfill_alert_config (enabled, threshold_orfas, cooldown_minutes)
SELECT true, 50, 360
WHERE NOT EXISTS (SELECT 1 FROM public.projeto_tarefas_backfill_alert_config);

ALTER TABLE public.projeto_tarefas_backfill_alert_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read backfill alert config"
  ON public.projeto_tarefas_backfill_alert_config;
CREATE POLICY "admins read backfill alert config"
  ON public.projeto_tarefas_backfill_alert_config
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admins write backfill alert config"
  ON public.projeto_tarefas_backfill_alert_config;
CREATE POLICY "admins write backfill alert config"
  ON public.projeto_tarefas_backfill_alert_config
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================================
-- 2. ALERT HISTORY TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.projeto_tarefas_backfill_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_at timestamptz NOT NULL DEFAULT now(),
  alert_type text NOT NULL CHECK (alert_type IN ('threshold_exceeded', 'error')),
  source text,
  orfas_count integer NOT NULL DEFAULT 0,
  threshold_used integer,
  recipients_count integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_backfill_alerts_triggered_at
  ON public.projeto_tarefas_backfill_alerts (triggered_at DESC);

ALTER TABLE public.projeto_tarefas_backfill_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read backfill alerts"
  ON public.projeto_tarefas_backfill_alerts;
CREATE POLICY "admins read backfill alerts"
  ON public.projeto_tarefas_backfill_alerts
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =====================================================================
-- 3. INTERNAL DISPATCH HELPER
-- =====================================================================
CREATE OR REPLACE FUNCTION public._dispatch_backfill_alert(
  p_alert_type   text,
  p_source       text,
  p_orfas_count  integer,
  p_threshold    integer,
  p_details      jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg            record;
  v_recipients     uuid[];
  v_recipient_id   uuid;
  v_inserted_count integer := 0;
  v_title          text;
  v_message        text;
  v_action_url     text := '/dashboard/admin/historico-backfill-tarefas';
  v_last_alert_at  timestamptz;
BEGIN
  SELECT * INTO v_cfg
  FROM public.projeto_tarefas_backfill_alert_config
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_cfg IS NULL OR v_cfg.enabled = false THEN
    RETURN 0;
  END IF;

  -- Cooldown: don't repeat the SAME alert_type within cooldown_minutes
  SELECT MAX(triggered_at) INTO v_last_alert_at
  FROM public.projeto_tarefas_backfill_alerts
  WHERE alert_type = p_alert_type
    AND triggered_at > now() - make_interval(mins => v_cfg.cooldown_minutes);

  IF v_last_alert_at IS NOT NULL THEN
    RETURN 0;
  END IF;

  -- Build recipient list: all admins (if enabled) + extra ids, deduped
  IF v_cfg.notify_admins THEN
    SELECT array_agg(DISTINCT user_id)
    INTO v_recipients
    FROM public.user_roles
    WHERE role = 'admin'::app_role;
  END IF;

  IF v_cfg.extra_recipient_ids IS NOT NULL AND array_length(v_cfg.extra_recipient_ids, 1) > 0 THEN
    v_recipients := COALESCE(v_recipients, ARRAY[]::uuid[]) || v_cfg.extra_recipient_ids;
  END IF;

  IF v_recipients IS NULL OR array_length(v_recipients, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF p_alert_type = 'error' THEN
    v_title := '[ALERTA] Falha no job de backfill de tarefas';
    v_message := 'O job diário backfill_data_conclusao_tarefas falhou na última execução ('
              || COALESCE(p_source, 'cron')
              || '). Verifique os detalhes no histórico.';
  ELSE
    v_title := '[ALERTA] Backfill detectou ' || p_orfas_count || ' tarefa(s) órfã(s)';
    v_message := 'Foram detectadas ' || p_orfas_count
              || ' tarefa(s) concluída(s) sem data_conclusao (limite: '
              || COALESCE(p_threshold::text, 'n/d')
              || '). Origem: ' || COALESCE(p_source, 'cron') || '.';
  END IF;

  -- Insert one in-app notification per recipient (dedup)
  FOR v_recipient_id IN
    SELECT DISTINCT unnest(v_recipients)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, action_url, read)
    VALUES (
      v_recipient_id,
      'backfill_alert',
      v_title,
      v_message,
      v_action_url,
      false
    );
    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  INSERT INTO public.projeto_tarefas_backfill_alerts
    (alert_type, source, orfas_count, threshold_used, recipients_count, details)
  VALUES
    (p_alert_type, p_source, COALESCE(p_orfas_count, 0), p_threshold, v_inserted_count, COALESCE(p_details, '{}'::jsonb));

  RETURN v_inserted_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._dispatch_backfill_alert(text, text, integer, integer, jsonb) FROM PUBLIC;

-- =====================================================================
-- 4. UPDATE BACKFILL FUNCTION TO TRIGGER ALERTS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.backfill_data_conclusao_tarefas(p_source text DEFAULT 'cron'::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_started_at  timestamptz := clock_timestamp();
  v_count       integer := 0;
  v_orfas_pre   integer := 0;
  v_threshold   integer;
  v_enabled     boolean;
  v_err_state   text;
  v_err_message text;
BEGIN
  -- Pre-count orphans (before fixing them) — used to evaluate threshold
  SELECT COUNT(*) INTO v_orfas_pre
  FROM public.projeto_tarefas
  WHERE status = 'concluida' AND data_conclusao IS NULL;

  BEGIN
    WITH atualizadas AS (
      UPDATE public.projeto_tarefas
      SET data_conclusao = COALESCE(updated_at, created_at, now())
      WHERE status = 'concluida'
        AND data_conclusao IS NULL
      RETURNING id
    )
    SELECT COUNT(*) INTO v_count FROM atualizadas;

    -- Log execution
    IF v_count > 0 THEN
      INSERT INTO public.projeto_tarefas_backfill_log (rows_updated, duration_ms, source, details)
      VALUES (
        v_count,
        EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::int,
        p_source,
        jsonb_build_object('strategy', 'updated_at_fallback_created_at', 'orfas_pre', v_orfas_pre)
      );
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.projeto_tarefas_backfill_log
        WHERE rows_updated = 0
          AND executed_at >= date_trunc('day', now())
      ) THEN
        INSERT INTO public.projeto_tarefas_backfill_log (rows_updated, duration_ms, source, details)
        VALUES (
          0,
          EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::int,
          p_source,
          jsonb_build_object('heartbeat', true, 'orfas_pre', v_orfas_pre)
        );
      END IF;
    END IF;

    -- Threshold alert evaluation
    SELECT enabled, threshold_orfas
    INTO v_enabled, v_threshold
    FROM public.projeto_tarefas_backfill_alert_config
    ORDER BY updated_at DESC
    LIMIT 1;

    IF COALESCE(v_enabled, false) AND v_orfas_pre >= COALESCE(v_threshold, 50) THEN
      PERFORM public._dispatch_backfill_alert(
        'threshold_exceeded',
        p_source,
        v_orfas_pre,
        v_threshold,
        jsonb_build_object('rows_updated', v_count, 'duration_ms',
          EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::int)
      );
    END IF;

    RETURN v_count;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE,
                            v_err_message = MESSAGE_TEXT;

    -- Best-effort: log the failure
    BEGIN
      INSERT INTO public.projeto_tarefas_backfill_log (rows_updated, duration_ms, source, details)
      VALUES (
        0,
        EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::int,
        p_source,
        jsonb_build_object(
          'error', true,
          'sqlstate', v_err_state,
          'message', v_err_message,
          'orfas_pre', v_orfas_pre
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- swallow secondary failures
      NULL;
    END;

    -- Best-effort: dispatch error alert
    BEGIN
      PERFORM public._dispatch_backfill_alert(
        'error',
        p_source,
        v_orfas_pre,
        NULL,
        jsonb_build_object('sqlstate', v_err_state, 'message', v_err_message)
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN 0;
  END;
END;
$function$;

-- =====================================================================
-- 5. ADMIN RPCs
-- =====================================================================
CREATE OR REPLACE FUNCTION public.backfill_alert_config_get()
RETURNS TABLE (
  id uuid,
  enabled boolean,
  threshold_orfas integer,
  cooldown_minutes integer,
  notify_admins boolean,
  extra_recipient_ids uuid[],
  updated_at timestamptz,
  updated_by uuid
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
  SELECT c.id, c.enabled, c.threshold_orfas, c.cooldown_minutes,
         c.notify_admins, c.extra_recipient_ids, c.updated_at, c.updated_by
  FROM public.projeto_tarefas_backfill_alert_config c
  ORDER BY c.updated_at DESC
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_alert_config_get() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_alert_config_get() TO authenticated;

CREATE OR REPLACE FUNCTION public.backfill_alert_config_update(
  p_enabled              boolean,
  p_threshold_orfas      integer,
  p_cooldown_minutes     integer,
  p_notify_admins        boolean,
  p_extra_recipient_ids  uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: requer perfil de administrador';
  END IF;

  IF p_threshold_orfas IS NULL OR p_threshold_orfas < 0 THEN
    RAISE EXCEPTION 'threshold_orfas deve ser >= 0';
  END IF;
  IF p_cooldown_minutes IS NULL OR p_cooldown_minutes < 0 THEN
    RAISE EXCEPTION 'cooldown_minutes deve ser >= 0';
  END IF;

  SELECT id INTO v_id
  FROM public.projeto_tarefas_backfill_alert_config
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.projeto_tarefas_backfill_alert_config
      (enabled, threshold_orfas, cooldown_minutes, notify_admins, extra_recipient_ids, updated_by)
    VALUES
      (COALESCE(p_enabled, true), p_threshold_orfas, p_cooldown_minutes,
       COALESCE(p_notify_admins, true), COALESCE(p_extra_recipient_ids, ARRAY[]::uuid[]), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.projeto_tarefas_backfill_alert_config
    SET enabled = COALESCE(p_enabled, enabled),
        threshold_orfas = p_threshold_orfas,
        cooldown_minutes = p_cooldown_minutes,
        notify_admins = COALESCE(p_notify_admins, notify_admins),
        extra_recipient_ids = COALESCE(p_extra_recipient_ids, ARRAY[]::uuid[]),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_alert_config_update(boolean, integer, integer, boolean, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_alert_config_update(boolean, integer, integer, boolean, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.backfill_alerts_listar(
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL,
  p_alert_type text       DEFAULT NULL,
  p_limit     integer     DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  triggered_at timestamptz,
  alert_type text,
  source text,
  orfas_count integer,
  threshold_used integer,
  recipients_count integer,
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
  SELECT a.id, a.triggered_at, a.alert_type, a.source, a.orfas_count,
         a.threshold_used, a.recipients_count, a.details
  FROM public.projeto_tarefas_backfill_alerts a
  WHERE (p_date_from IS NULL OR a.triggered_at >= p_date_from)
    AND (p_date_to   IS NULL OR a.triggered_at <  p_date_to)
    AND (p_alert_type IS NULL OR a.alert_type = p_alert_type)
  ORDER BY a.triggered_at DESC
  LIMIT GREATEST(LEAST(COALESCE(p_limit, 100), 500), 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.backfill_alerts_listar(timestamptz, timestamptz, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_alerts_listar(timestamptz, timestamptz, text, integer) TO authenticated;