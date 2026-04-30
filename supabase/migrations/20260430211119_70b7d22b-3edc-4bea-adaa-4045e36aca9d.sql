ALTER TABLE public.asana_sync_log
  ADD COLUMN IF NOT EXISTS cursor jsonb;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_asana_modified
  ON public.projeto_tarefas ((asana_json_raw->>'modified_at'))
  WHERE asana_gid IS NOT NULL;