-- Migration 4: Create erp_sync_log table
CREATE TABLE public.erp_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type varchar(50) NOT NULL,
  entity_id uuid NOT NULL,
  action varchar(30) NOT NULL,
  direction varchar(10) NOT NULL DEFAULT 'outbound',
  request_payload jsonb,
  response_payload jsonb,
  response_status int,
  success boolean DEFAULT false,
  error_message text,
  duration_ms int,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Indexes
CREATE INDEX idx_erp_sync_log_entity ON public.erp_sync_log (entity_type, entity_id);
CREATE INDEX idx_erp_sync_log_created ON public.erp_sync_log (created_at DESC);
CREATE INDEX idx_erp_sync_log_direction ON public.erp_sync_log (direction, created_at DESC);

-- RLS
ALTER TABLE public.erp_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read erp_sync_log"
  ON public.erp_sync_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert erp_sync_log"
  ON public.erp_sync_log FOR INSERT
  TO service_role
  WITH CHECK (true);
