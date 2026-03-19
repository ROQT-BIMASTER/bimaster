-- Migration 3: Add ERP columns to erp_export_queue
ALTER TABLE public.erp_export_queue
  ADD COLUMN IF NOT EXISTS erp_titulo_id varchar(50),
  ADD COLUMN IF NOT EXISTS erp_response_code varchar(20);
