-- 1) Habilitar extensões para agendamento
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2) Tabela de auditoria do backfill
CREATE TABLE IF NOT EXISTS public.projeto_tarefas_backfill_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  executed_at timestamptz NOT NULL DEFAULT now(),
  rows_updated integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'cron',
  details jsonb
);

CREATE INDEX IF NOT EXISTS idx_backfill_log_executed_at
  ON public.projeto_tarefas_backfill_log (executed_at DESC);

ALTER TABLE public.projeto_tarefas_backfill_log ENABLE ROW LEVEL SECURITY;

-- Apenas administradores podem ver o log; ninguém escreve via API (apenas SECURITY DEFINER)
DROP POLICY IF EXISTS "Admins podem ver log de backfill" ON public.projeto_tarefas_backfill_log;
CREATE POLICY "Admins podem ver log de backfill"
ON public.projeto_tarefas_backfill_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3) Função de backfill (SECURITY DEFINER para executar via cron sem usuário)
CREATE OR REPLACE FUNCTION public.backfill_data_conclusao_tarefas(p_source text DEFAULT 'cron')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_at timestamptz := clock_timestamp();
  v_count integer := 0;
BEGIN
  WITH atualizadas AS (
    UPDATE public.projeto_tarefas
    SET data_conclusao = COALESCE(updated_at, created_at, now())
    WHERE status = 'concluida'
      AND data_conclusao IS NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM atualizadas;

  -- Registra apenas execuções com órfãs encontradas OU 1x ao dia para deixar pulso
  IF v_count > 0 THEN
    INSERT INTO public.projeto_tarefas_backfill_log (rows_updated, duration_ms, source, details)
    VALUES (
      v_count,
      EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started_at))::int,
      p_source,
      jsonb_build_object('strategy', 'updated_at_fallback_created_at')
    );
  ELSE
    -- Heartbeat: registra no máximo 1 execução vazia por dia
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
        jsonb_build_object('heartbeat', true)
      );
    END IF;
  END IF;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_data_conclusao_tarefas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_data_conclusao_tarefas(text) TO authenticated, service_role;