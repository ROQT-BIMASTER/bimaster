
-- Table: asana_sync_mappings
CREATE TABLE public.asana_sync_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asana_gid TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'section', 'task', 'user', 'comment')),
  local_id UUID NOT NULL,
  workspace_gid TEXT,
  extra_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (asana_gid, entity_type)
);

ALTER TABLE public.asana_sync_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sync mappings"
  ON public.asana_sync_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table: asana_sync_log
CREATE TABLE public.asana_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_gid TEXT,
  project_gids TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  projects_synced INT DEFAULT 0,
  sections_synced INT DEFAULT 0,
  tasks_synced INT DEFAULT 0,
  comments_synced INT DEFAULT 0,
  users_mapped INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  started_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asana_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
  ON public.asana_sync_log FOR SELECT TO authenticated
  USING (started_by = auth.uid());

CREATE POLICY "Users can create sync logs"
  ON public.asana_sync_log FOR INSERT TO authenticated
  WITH CHECK (started_by = auth.uid());

CREATE POLICY "Users can update their own sync logs"
  ON public.asana_sync_log FOR UPDATE TO authenticated
  USING (started_by = auth.uid());

-- Add asana_gid to projetos and projeto_tarefas
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS asana_gid TEXT;
ALTER TABLE public.projeto_tarefas ADD COLUMN IF NOT EXISTS asana_gid TEXT;
ALTER TABLE public.projeto_secoes ADD COLUMN IF NOT EXISTS asana_gid TEXT;

CREATE INDEX IF NOT EXISTS idx_projetos_asana_gid ON public.projetos(asana_gid) WHERE asana_gid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_asana_gid ON public.projeto_tarefas(asana_gid) WHERE asana_gid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projeto_secoes_asana_gid ON public.projeto_secoes(asana_gid) WHERE asana_gid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_sync_mappings_gid ON public.asana_sync_mappings(asana_gid);
