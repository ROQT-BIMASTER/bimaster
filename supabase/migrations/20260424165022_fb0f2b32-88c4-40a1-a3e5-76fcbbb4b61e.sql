-- =====================================================================
-- PR-60 (v3.4.24): Backfill de data_conclusao em lotes (chunked)
-- =====================================================================
-- Objetivo: evitar lock prolongado em projeto_tarefas quando houver
-- grande volume de tarefas concluídas sem data_conclusao. A versão
-- anterior fazia um único UPDATE em massa, que poderia escalar para
-- lock de tabela e bloquear escritas concorrentes do app.
--
-- Estratégia:
--   - Loop em PL/pgSQL processando lotes de p_batch_size linhas (padrão 500).
--   - Cada lote usa SELECT ... FOR UPDATE SKIP LOCKED para não disputar
--     com transações em andamento (UI de tarefas continua responsiva).
--   - Hard cap de p_max_batches (padrão 200 ⇒ até 100k linhas/execução)
--     impede execução infinita; restante é processado na próxima rodada.
--   - PERFORM pg_sleep(0) entre lotes cede tempo de CPU/IO ao scheduler.
--   - Mantém compatibilidade: chamadas existentes
--     `backfill_data_conclusao_tarefas('cron')` continuam funcionando
--     graças aos parâmetros default.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.backfill_data_conclusao_tarefas(
  p_source       text    DEFAULT 'cron',
  p_batch_size   integer DEFAULT 500,
  p_max_batches  integer DEFAULT 200
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_started_at    timestamptz := clock_timestamp();
  v_count         integer := 0;
  v_batch_count   integer := 0;
  v_batches_done  integer := 0;
  v_orfas_pre     integer := 0;
  v_orfas_post    integer := 0;
  v_threshold     integer;
  v_enabled       boolean;
  v_err_state     text;
  v_err_message   text;
  v_batch_size    integer;
  v_max_batches   integer;
BEGIN
  -- Sanitização de parâmetros (clamp em faixas seguras)
  v_batch_size  := GREATEST(50,  LEAST(COALESCE(p_batch_size,  500), 5000));
  v_max_batches := GREATEST(1,   LEAST(COALESCE(p_max_batches, 200), 2000));

  -- Pré-contagem de órfãs (avaliação de threshold de alerta)
  SELECT COUNT(*) INTO v_orfas_pre
  FROM public.projeto_tarefas
  WHERE status = 'concluida' AND data_conclusao IS NULL;

  BEGIN
    -- Loop em lotes pequenos com SKIP LOCKED para não bloquear o app
    LOOP
      EXIT WHEN v_batches_done >= v_max_batches;

      WITH cte AS (
        SELECT id
        FROM public.projeto_tarefas
        WHERE status = 'concluida'
          AND data_conclusao IS NULL
        ORDER BY updated_at NULLS LAST, created_at NULLS LAST
        LIMIT v_batch_size
        FOR UPDATE SKIP LOCKED
      ),
      upd AS (
        UPDATE public.projeto_tarefas pt
        SET data_conclusao = COALESCE(pt.updated_at, pt.created_at, now())
        FROM cte
        WHERE pt.id = cte.id
        RETURNING pt.id
      )
      SELECT COUNT(*) INTO v_batch_count FROM upd;

      v_count        := v_count + v_batch_count;
      v_batches_done := v_batches_done + 1;

      EXIT WHEN v_batch_count = 0;

      -- Cede o scheduler entre lotes para reduzir contenção
      PERFORM pg_sleep(0);
    END LOOP;

    -- Pós-contagem (quanto ainda restou para próxima janela)
    SELECT COUNT(*) INTO v_orfas_post
    FROM public.projeto_tarefas
    WHERE status = 'concluida' AND data_conclusao IS NULL;

    -- Log: registra execução real ou heartbeat diário
    IF v_count > 0 THEN
      INSERT INTO public.projeto_tarefas_backfill_log (rows_updated, duration_ms, source, details)
      VALUES (
        v_count,
        EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::int,
        p_source,
        jsonb_build_object(
          'strategy',      'chunked_skip_locked',
          'batch_size',    v_batch_size,
          'max_batches',   v_max_batches,
          'batches_done',  v_batches_done,
          'orfas_pre',     v_orfas_pre,
          'orfas_post',    v_orfas_post,
          'reached_cap',   v_batches_done >= v_max_batches AND v_orfas_post > 0
        )
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
          jsonb_build_object(
            'heartbeat',    true,
            'strategy',     'chunked_skip_locked',
            'batch_size',   v_batch_size,
            'orfas_pre',    v_orfas_pre,
            'orfas_post',   v_orfas_post
          )
        );
      END IF;
    END IF;

    -- Avaliação de threshold de alerta (mantém comportamento PR-57)
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
        jsonb_build_object(
          'rows_updated',  v_count,
          'orfas_post',    v_orfas_post,
          'batches_done',  v_batches_done,
          'reached_cap',   v_batches_done >= v_max_batches AND v_orfas_post > 0,
          'duration_ms',   EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::int
        )
      );
    END IF;

    RETURN v_count;

  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err_state = RETURNED_SQLSTATE,
                            v_err_message = MESSAGE_TEXT;

    -- Best-effort: log da falha
    BEGIN
      INSERT INTO public.projeto_tarefas_backfill_log (rows_updated, duration_ms, source, details)
      VALUES (
        v_count,
        EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::int,
        p_source,
        jsonb_build_object(
          'error',         true,
          'sqlstate',      v_err_state,
          'message',       v_err_message,
          'strategy',      'chunked_skip_locked',
          'batch_size',    v_batch_size,
          'batches_done',  v_batches_done,
          'orfas_pre',     v_orfas_pre,
          'partial_rows',  v_count
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Best-effort: alerta de erro
    BEGIN
      PERFORM public._dispatch_backfill_alert(
        'error',
        p_source,
        v_orfas_pre,
        NULL,
        jsonb_build_object(
          'sqlstate',      v_err_state,
          'message',       v_err_message,
          'batches_done',  v_batches_done,
          'partial_rows',  v_count
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RAISE;
  END;
END;
$function$;

-- Permissões: revoga público, concede a admin via SECURITY DEFINER chains
REVOKE ALL ON FUNCTION public.backfill_data_conclusao_tarefas(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_data_conclusao_tarefas(text, integer, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.backfill_data_conclusao_tarefas(text, integer, integer) IS
'PR-60: Backfill chunked de data_conclusao em projeto_tarefas. Processa em lotes (default 500) com FOR UPDATE SKIP LOCKED para evitar lock prolongado em alto volume. Hard cap de p_max_batches (default 200) limita cada execução; restante segue na próxima rodada do cron.';