-- Tabela para rastrear última sincronização por tipo
CREATE TABLE IF NOT EXISTS public.sync_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  tipo_sync TEXT NOT NULL CHECK (tipo_sync IN ('full', 'incremental')),
  last_sync_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  duration_ms INTEGER,
  status TEXT DEFAULT 'completed' CHECK (status IN ('started', 'in_progress', 'completed', 'failed', 'partial')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sync_tracking_entidade ON public.sync_tracking(entidade, tipo_sync);
CREATE INDEX IF NOT EXISTS idx_sync_tracking_last_sync ON public.sync_tracking(last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_tracking_status ON public.sync_tracking(status);

-- Função para obter último timestamp de sincronização
CREATE OR REPLACE FUNCTION public.get_last_sync_timestamp(p_entidade TEXT, p_tipo TEXT DEFAULT 'full')
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN COALESCE(
    (SELECT last_sync_at FROM public.sync_tracking 
     WHERE entidade = p_entidade 
       AND tipo_sync = p_tipo
       AND status IN ('completed', 'partial')
     ORDER BY last_sync_at DESC 
     LIMIT 1),
    now() - INTERVAL '1 year'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para registrar início de sincronização
CREATE OR REPLACE FUNCTION public.start_sync(
  p_entidade TEXT, 
  p_tipo TEXT DEFAULT 'full',
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_sync_id UUID;
BEGIN
  INSERT INTO public.sync_tracking (entidade, tipo_sync, status, metadata)
  VALUES (p_entidade, p_tipo, 'started', p_metadata)
  RETURNING id INTO v_sync_id;
  
  RETURN v_sync_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para finalizar sincronização
CREATE OR REPLACE FUNCTION public.complete_sync(
  p_sync_id UUID,
  p_records_processed INTEGER,
  p_records_inserted INTEGER DEFAULT 0,
  p_records_updated INTEGER DEFAULT 0,
  p_records_skipped INTEGER DEFAULT 0,
  p_duration_ms INTEGER DEFAULT 0,
  p_status TEXT DEFAULT 'completed',
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.sync_tracking
  SET 
    last_sync_at = now(),
    records_processed = p_records_processed,
    records_inserted = p_records_inserted,
    records_updated = p_records_updated,
    records_skipped = p_records_skipped,
    duration_ms = p_duration_ms,
    status = p_status,
    error_message = p_error_message
  WHERE id = p_sync_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RLS
ALTER TABLE public.sync_tracking ENABLE ROW LEVEL SECURITY;

-- Política para visualização (admin/supervisor)
CREATE POLICY "Admins podem ver sync_tracking" ON public.sync_tracking
  FOR SELECT USING (public.is_admin_or_supervisor(auth.uid()));

-- Política para inserção (service role via edge functions)
CREATE POLICY "Service role pode inserir sync_tracking" ON public.sync_tracking
  FOR INSERT WITH CHECK (true);

-- Política para atualização (service role via edge functions)  
CREATE POLICY "Service role pode atualizar sync_tracking" ON public.sync_tracking
  FOR UPDATE USING (true);

-- View para resumo de sincronizações
CREATE OR REPLACE VIEW public.sync_tracking_summary AS
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