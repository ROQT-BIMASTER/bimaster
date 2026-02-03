-- Função de limpeza em lotes para audit_logs
-- Deleta registros antigos em pequenos lotes para evitar timeout

CREATE OR REPLACE FUNCTION public.cleanup_audit_logs_batch(
  batch_size INTEGER DEFAULT 50000,
  retention_days INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM public.audit_logs
    WHERE id IN (
      SELECT id FROM public.audit_logs
      WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
      LIMIT batch_size
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- Comentário explicativo
COMMENT ON FUNCTION public.cleanup_audit_logs_batch IS 'Deleta registros antigos da tabela audit_logs em lotes pequenos para evitar timeout. Executada via cron a cada 10 minutos.';