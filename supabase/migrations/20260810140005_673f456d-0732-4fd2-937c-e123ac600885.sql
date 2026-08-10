DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'aplicar-clientes-rp-no-master';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'aplicar-clientes-rp-no-master',
  '*/15 * * * *',
  $$SELECT public.aplicar_clientes_rp_no_master();$$
);