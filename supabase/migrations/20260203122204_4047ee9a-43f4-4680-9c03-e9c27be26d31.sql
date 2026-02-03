
-- Limpar registros antigos de audit_logs (mais de 30 dias)
DELETE FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '30 days';

-- Limpar registros antigos de sync_control (mais de 7 dias)
DELETE FROM sync_control 
WHERE created_at < NOW() - INTERVAL '7 days';

-- Criar cron job para limpeza diária automática de audit_logs
SELECT cron.schedule(
  'cleanup-audit-logs-daily',
  '0 3 * * *', -- Todo dia às 3h da manhã
  $$DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '30 days'$$
);

-- Criar cron job para limpeza diária automática de sync_control
SELECT cron.schedule(
  'cleanup-sync-control-daily', 
  '0 3 * * *', -- Todo dia às 3h da manhã
  $$DELETE FROM sync_control WHERE created_at < NOW() - INTERVAL '7 days'$$
);

-- Vacuum para recuperar espaço em disco
-- NOTA: VACUUM FULL requer execução manual no dashboard
COMMENT ON TABLE audit_logs IS 'Tabela de auditoria com retenção de 30 dias. Limpeza automática configurada via cron.';
COMMENT ON TABLE sync_control IS 'Controle de sincronização com retenção de 7 dias. Limpeza automática configurada via cron.';
