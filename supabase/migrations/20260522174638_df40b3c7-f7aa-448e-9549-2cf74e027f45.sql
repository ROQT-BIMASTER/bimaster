
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS asana_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS asana_last_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS asana_last_sync_error TEXT;

ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS asana_modified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_asana_modified_at
  ON public.projeto_tarefas (asana_modified_at DESC)
  WHERE asana_gid IS NOT NULL;

-- Backfill: extrai modified_at do snapshot JSON que já guardamos
UPDATE public.projeto_tarefas
SET asana_modified_at = (asana_json_raw->>'modified_at')::timestamptz
WHERE asana_gid IS NOT NULL
  AND asana_modified_at IS NULL
  AND asana_json_raw ? 'modified_at'
  AND (asana_json_raw->>'modified_at') ~ '^\d{4}-\d{2}-\d{2}T';
