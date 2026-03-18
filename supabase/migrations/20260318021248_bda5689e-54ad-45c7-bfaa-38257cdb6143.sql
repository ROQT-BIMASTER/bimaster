-- Add cursor columns to existing sync_control table
ALTER TABLE public.sync_control 
  ADD COLUMN IF NOT EXISTS workflow_name text,
  ADD COLUMN IF NOT EXISTS offset_cursor bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registros_ultima_sync integer DEFAULT 0;

-- Unique index for workflow-based lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_control_workflow_name 
  ON public.sync_control (workflow_name) WHERE workflow_name IS NOT NULL;

-- Insert initial cursor record for contas_receber
INSERT INTO public.sync_control (workflow_name, offset_cursor, entidade)
VALUES ('contas_receber', 0, 'contas_receber')
ON CONFLICT DO NOTHING;