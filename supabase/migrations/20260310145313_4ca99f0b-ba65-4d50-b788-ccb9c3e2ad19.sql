ALTER TABLE public.china_produto_submissoes 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delete_reason text DEFAULT NULL;