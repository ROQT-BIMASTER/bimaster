-- Remover a view com SECURITY DEFINER e recriar sem
DROP VIEW IF EXISTS public.sync_tracking_summary;

-- Recriar a view sem SECURITY DEFINER (usa permissões do usuário)
CREATE VIEW public.sync_tracking_summary AS
SELECT 
  entidade,
  tipo_sync,
  COUNT(*) as total_syncs,
  SUM(records_processed) as total_records_processed,
  AVG(duration_ms) as avg_duration_ms,
  MAX(last_sync_at) as last_sync_at,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_count
FROM public.sync_tracking
WHERE last_sync_at > now() - INTERVAL '30 days'
GROUP BY entidade, tipo_sync;