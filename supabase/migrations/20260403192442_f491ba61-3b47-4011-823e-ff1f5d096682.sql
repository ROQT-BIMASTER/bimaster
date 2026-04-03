
-- 1. Sync metrics table for observability
CREATE TABLE IF NOT EXISTS public.sync_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity TEXT NOT NULL,
  empresa_id INTEGER NOT NULL DEFAULT 1,
  pages INTEGER NOT NULL DEFAULT 0,
  rows INTEGER NOT NULL DEFAULT 0,
  rows_inserted INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  deadlock_retries INTEGER NOT NULL DEFAULT 0,
  rows_per_second INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sync_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sync_metrics"
  ON public.sync_metrics FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert sync_metrics"
  ON public.sync_metrics FOR INSERT WITH CHECK (true);

CREATE INDEX idx_sync_metrics_entity_created ON public.sync_metrics (entity, created_at DESC);
CREATE INDEX idx_sync_metrics_empresa_created ON public.sync_metrics (empresa_id, created_at DESC);

-- 2. Materialized view for dashboard KPIs
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_financeiro_dashboard AS
SELECT
  empresa_id,
  status,
  COUNT(*) AS total_titulos,
  COALESCE(SUM(valor_original), 0) AS total_valor_original,
  COALESCE(SUM(valor_aberto), 0) AS total_valor_aberto,
  COALESCE(SUM(valor_recebido), 0) AS total_valor_recebido,
  -- Aging brackets
  COUNT(*) FILTER (WHERE status = 'vencido' AND data_vencimento >= CURRENT_DATE - INTERVAL '30 days') AS vencido_0_30,
  COUNT(*) FILTER (WHERE status = 'vencido' AND data_vencimento < CURRENT_DATE - INTERVAL '30 days' AND data_vencimento >= CURRENT_DATE - INTERVAL '60 days') AS vencido_31_60,
  COUNT(*) FILTER (WHERE status = 'vencido' AND data_vencimento < CURRENT_DATE - INTERVAL '60 days' AND data_vencimento >= CURRENT_DATE - INTERVAL '90 days') AS vencido_61_90,
  COUNT(*) FILTER (WHERE status = 'vencido' AND data_vencimento < CURRENT_DATE - INTERVAL '90 days') AS vencido_90_plus,
  COALESCE(SUM(valor_aberto) FILTER (WHERE status = 'vencido'), 0) AS total_valor_vencido,
  COALESCE(SUM(valor_aberto) FILTER (WHERE status = 'pendente'), 0) AS total_valor_pendente,
  now() AS refreshed_at
FROM public.contas_receber
GROUP BY empresa_id, status;

CREATE UNIQUE INDEX idx_mv_fin_dash_empresa_status ON public.mv_financeiro_dashboard (empresa_id, status);

-- 3. Schedule MV refresh every 15 minutes
SELECT cron.schedule(
  'refresh-mv-financeiro-dashboard',
  '*/15 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_financeiro_dashboard'
);
