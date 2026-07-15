ALTER TABLE public.fornecedor_estoque_sync_log
  ADD COLUMN IF NOT EXISTS deleted_stale integer NOT NULL DEFAULT 0;