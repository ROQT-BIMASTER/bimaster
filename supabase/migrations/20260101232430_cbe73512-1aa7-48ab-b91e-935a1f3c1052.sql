-- Adicionar colunas que o N8N espera na tabela sync_tracking
ALTER TABLE public.sync_tracking 
ADD COLUMN IF NOT EXISTS sync_name TEXT,
ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS total_records INTEGER DEFAULT 0;

-- Criar índice único para sync_name (para ON CONFLICT funcionar)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_tracking_sync_name ON public.sync_tracking(sync_name) WHERE sync_name IS NOT NULL;

-- Atualizar RLS para permitir acesso do service role
DROP POLICY IF EXISTS "Allow service role access on sync_tracking" ON public.sync_tracking;
CREATE POLICY "Allow service role access on sync_tracking" 
ON public.sync_tracking 
FOR ALL 
USING (true)
WITH CHECK (true);