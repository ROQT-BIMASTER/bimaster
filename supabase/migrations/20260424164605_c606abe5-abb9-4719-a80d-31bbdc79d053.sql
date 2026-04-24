
-- RPC admin: status dos cron jobs relacionados a tarefas + última execução
CREATE OR REPLACE FUNCTION public.admin_tarefas_cron_status()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  command text,
  last_run_started_at timestamptz,
  last_run_finished_at timestamptz,
  last_run_status text,
  last_run_return_message text,
  seconds_since_last_run numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  RETURN QUERY
  SELECT
    j.jobid,
    j.jobname::text,
    j.schedule::text,
    j.active,
    j.command::text,
    r.start_time           AS last_run_started_at,
    r.end_time             AS last_run_finished_at,
    r.status::text         AS last_run_status,
    r.return_message::text AS last_run_return_message,
    CASE
      WHEN r.start_time IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM (now() - r.start_time))
    END AS seconds_since_last_run
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT *
    FROM cron.job_run_details d
    WHERE d.jobid = j.jobid
    ORDER BY d.start_time DESC NULLS LAST
    LIMIT 1
  ) r ON TRUE
  WHERE
    j.jobname IN (
      'backfill-data-conclusao-tarefas-daily',
      'consistency-check-tarefas-data-conclusao-weekly'
    )
    OR j.command ILIKE '%backfill_data_conclusao_tarefas%'
    OR j.command ILIKE '%consistency_check_tarefas_data_conclusao%'
  ORDER BY j.jobname;
END;
$function$;
