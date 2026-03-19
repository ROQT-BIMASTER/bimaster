-- Migration 2: Add ERP columns to trade_chart_of_accounts
ALTER TABLE public.trade_chart_of_accounts
  ADD COLUMN IF NOT EXISTS erp_code varchar(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS erp_sync_status varchar(20) DEFAULT 'pending';
