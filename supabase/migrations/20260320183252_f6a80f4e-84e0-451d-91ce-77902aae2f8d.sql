
-- Add queue-oriented columns to existing erp_sync_log
ALTER TABLE erp_sync_log 
  ADD COLUMN IF NOT EXISTS tabela text,
  ADD COLUMN IF NOT EXISTS operacao text,
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS tentativas integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz DEFAULT now();

-- Ensure RLS is enabled (should already be)
ALTER TABLE erp_sync_log ENABLE ROW LEVEL SECURITY;

-- Add policy for authenticated users if not exists
DO $$ BEGIN
  CREATE POLICY "erp_sync_log_auth_access" ON erp_sync_log
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
