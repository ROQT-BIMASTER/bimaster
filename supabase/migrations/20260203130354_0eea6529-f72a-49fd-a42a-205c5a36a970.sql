-- Função de limpeza automática (mantém apenas últimos 30 dias)
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Audit logs cleanup: % registros removidos', deleted_count;
END;
$$;

-- Remove cron jobs antigos de auditoria se existirem
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE jobname LIKE '%audit%' OR jobname LIKE '%cleanup_audit%';

-- Cria job de limpeza diária às 3h da manhã
SELECT cron.schedule(
  'auditoria-cleanup-diario',
  '0 3 * * *',
  $$SELECT public.cleanup_audit_logs_daily();$$
);