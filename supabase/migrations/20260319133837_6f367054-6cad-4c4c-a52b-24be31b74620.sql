-- Migration 1: Add ERP mapping + structured address columns to fabrica_fornecedores
ALTER TABLE public.fabrica_fornecedores
  ADD COLUMN IF NOT EXISTS erp_code varchar(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS erp_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS erp_sync_status varchar(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS inscricao_estadual varchar(20),
  ADD COLUMN IF NOT EXISTS inscricao_municipal varchar(20),
  ADD COLUMN IF NOT EXISTS cep varchar(10),
  ADD COLUMN IF NOT EXISTS cidade varchar(100),
  ADD COLUMN IF NOT EXISTS uf varchar(2),
  ADD COLUMN IF NOT EXISTS bairro varchar(100),
  ADD COLUMN IF NOT EXISTS numero varchar(20),
  ADD COLUMN IF NOT EXISTS complemento varchar(100);
