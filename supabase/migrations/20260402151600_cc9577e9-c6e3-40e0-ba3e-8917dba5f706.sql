-- Add ACOM tracking code field to tasks
ALTER TABLE public.projeto_tarefas ADD COLUMN IF NOT EXISTS codigo_acom VARCHAR(50);

-- Add asana_gid to attachments for deduplication during sync
ALTER TABLE public.projeto_tarefa_anexos ADD COLUMN IF NOT EXISTS asana_gid TEXT;

-- Index for fast lookup during sync
CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_anexos_asana_gid ON public.projeto_tarefa_anexos(asana_gid) WHERE asana_gid IS NOT NULL;