-- Migration 6: Add ERP columns to financial_payment_queue
ALTER TABLE public.financial_payment_queue
  ADD COLUMN IF NOT EXISTS titulo_numero varchar,
  ADD COLUMN IF NOT EXISTS erp_titulo_id varchar(50),
  ADD COLUMN IF NOT EXISTS erp_response_code varchar(20),
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS erp_sync_status varchar(20) DEFAULT 'pending';