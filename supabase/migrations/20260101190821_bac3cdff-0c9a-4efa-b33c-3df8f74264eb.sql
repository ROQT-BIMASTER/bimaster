-- Create sync_logs table for Edge Function compatibility
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  registros_processados INTEGER DEFAULT 0,
  erro_mensagem TEXT,
  detalhes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_sync_logs_tipo_created ON public.sync_logs(tipo, created_at DESC);

-- Enable RLS
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read sync_logs"
  ON public.sync_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage sync_logs"
  ON public.sync_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);