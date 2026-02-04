-- =====================================================
-- LIMPEZA AGRESSIVA DO SYNC_CONTROL
-- Objetivo: Reduzir custos eliminando logs redundantes
-- =====================================================

-- 1. Limpar dados antigos imediatamente (manter apenas 24h)
DELETE FROM sync_control WHERE created_at < NOW() - INTERVAL '24 hours';

-- 2. Limpar sync_chunks_tracking
TRUNCATE sync_chunks_tracking;

-- 3. Atualizar o cron job existente para rodar a cada 6 horas
-- Primeiro, remover o job antigo se existir
SELECT cron.unschedule('cleanup-sync-control-daily');

-- 4. Criar novo cron job com limpeza a cada 6 horas e retenção de 1 dia
SELECT cron.schedule(
  'cleanup-sync-control-6h',
  '0 */6 * * *',
  $$
  -- Limpar sync_control (retenção de 1 dia)
  DELETE FROM sync_control WHERE created_at < NOW() - INTERVAL '1 day';
  
  -- Limpar sync_chunks_tracking antigos (retenção de 6 horas)
  DELETE FROM sync_chunks_tracking WHERE created_at < NOW() - INTERVAL '6 hours';
  
  -- Limpar rate limiter expirado
  DELETE FROM sync_rate_limiter WHERE expires_at < NOW();
  $$
);