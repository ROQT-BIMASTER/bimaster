-- Migration 7: Add columns to erp_export_queue + Complete RLS on erp_sync_log

-- Part 1: Add missing columns to erp_export_queue
ALTER TABLE public.erp_export_queue
  ADD COLUMN IF NOT EXISTS titulo_numero varchar,
  ADD COLUMN IF NOT EXISTS erp_sync_status varchar(20) DEFAULT 'pending';

-- Part 2: Complete RLS policies on erp_sync_log
CREATE POLICY "Authenticated users can insert erp_sync_log"
  ON public.erp_sync_log FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Service role can update erp_sync_log"
  ON public.erp_sync_log FOR UPDATE
  TO service_role USING (true);

CREATE POLICY "Service role can delete erp_sync_log"
  ON public.erp_sync_log FOR DELETE
  TO service_role USING (true);