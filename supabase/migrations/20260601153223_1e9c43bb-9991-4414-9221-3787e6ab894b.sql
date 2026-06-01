-- RPC: purga definitivamente tarefas/subtarefas com mais de 30 dias na lixeira
CREATE OR REPLACE FUNCTION public.rpc_purge_projeto_tarefas_expiradas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  DELETE FROM public.projeto_tarefas
   WHERE excluida_em IS NOT NULL
     AND excluida_em < now() - interval '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_purge_projeto_tarefas_expiradas()
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_purge_projeto_tarefas_expiradas() TO service_role;

-- Cron diário às 03:20 (logo após o de projetos, 03:15)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job
      WHERE jobname = 'purge-projeto-tarefas-lixeira';
    PERFORM cron.schedule(
      'purge-projeto-tarefas-lixeira',
      '20 3 * * *',
      $cron$ SELECT public.rpc_purge_projeto_tarefas_expiradas(); $cron$
    );
  END IF;
END $$;