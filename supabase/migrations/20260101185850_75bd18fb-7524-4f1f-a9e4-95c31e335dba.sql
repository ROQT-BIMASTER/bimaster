-- Função para completar sync tracking
CREATE OR REPLACE FUNCTION public.complete_sync(
  p_sync_id UUID,
  p_records_processed INTEGER DEFAULT 0,
  p_records_inserted INTEGER DEFAULT 0,
  p_records_updated INTEGER DEFAULT 0,
  p_records_skipped INTEGER DEFAULT 0,
  p_duration_ms INTEGER DEFAULT 0,
  p_status TEXT DEFAULT 'completed',
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sync_tracking
  SET 
    status = p_status,
    records_processed = p_records_processed,
    records_inserted = p_records_inserted,
    records_updated = p_records_updated,
    records_skipped = p_records_skipped,
    duration_ms = p_duration_ms,
    error_message = p_error_message,
    last_sync_at = NOW()
  WHERE id = p_sync_id;
END;
$$;

-- Adicionar colunas faltantes em sync_tracking se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sync_tracking' AND column_name = 'records_inserted') THEN
    ALTER TABLE sync_tracking ADD COLUMN records_inserted INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sync_tracking' AND column_name = 'records_updated') THEN
    ALTER TABLE sync_tracking ADD COLUMN records_updated INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sync_tracking' AND column_name = 'records_skipped') THEN
    ALTER TABLE sync_tracking ADD COLUMN records_skipped INTEGER DEFAULT 0;
  END IF;
END;
$$;