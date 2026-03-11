
-- Add export_type column to distinguish registration (provisão) from payment (baixa)
ALTER TABLE public.erp_export_queue 
  ADD COLUMN IF NOT EXISTS export_type text NOT NULL DEFAULT 'payment';

-- Add comment for documentation
COMMENT ON COLUMN public.erp_export_queue.export_type IS 'registration = provisão ao aceitar | payment = baixa ao pagar';

-- Drop existing constraints if they exist and recreate with expanded values
DO $$
BEGIN
  -- Try to drop existing export_channel constraint
  BEGIN
    ALTER TABLE public.erp_export_queue DROP CONSTRAINT IF EXISTS erp_export_queue_export_channel_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- Try to drop existing export_status constraint
  BEGIN
    ALTER TABLE public.erp_export_queue DROP CONSTRAINT IF EXISTS erp_export_queue_export_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Recreate with expanded values including pull_api and exported
ALTER TABLE public.erp_export_queue 
  ADD CONSTRAINT erp_export_queue_export_channel_check 
  CHECK (export_channel IN ('n8n', 'rest_api', 'sql_direct', 'pull_api'));

ALTER TABLE public.erp_export_queue 
  ADD CONSTRAINT erp_export_queue_export_status_check 
  CHECK (export_status IN ('pending', 'success', 'error', 'exported'));

-- Add export_type constraint
ALTER TABLE public.erp_export_queue 
  ADD CONSTRAINT erp_export_queue_export_type_check 
  CHECK (export_type IN ('registration', 'payment'));
