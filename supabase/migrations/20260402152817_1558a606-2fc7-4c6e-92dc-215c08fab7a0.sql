-- 1. Add JSONB columns to projeto_tarefas
ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS campos_customizados JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS asana_json_raw JSONB;

-- 2. Tags table
CREATE TABLE IF NOT EXISTS public.projeto_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  cor VARCHAR(20),
  asana_gid TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projeto_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tags"
  ON public.projeto_tags FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage tags"
  ON public.projeto_tags FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tags"
  ON public.projeto_tags FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete tags"
  ON public.projeto_tags FOR DELETE
  TO authenticated USING (auth.uid() IS NOT NULL);

-- 3. Task-Tag N:N
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tarefa_id UUID NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.projeto_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tarefa_id, tag_id)
);

ALTER TABLE public.projeto_tarefa_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tarefa_tags"
  ON public.projeto_tarefa_tags FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage tarefa_tags"
  ON public.projeto_tarefa_tags FOR ALL
  TO authenticated USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_tags_tarefa ON public.projeto_tarefa_tags(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_tags_tag ON public.projeto_tarefa_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_projeto_tags_asana_gid ON public.projeto_tags(asana_gid) WHERE asana_gid IS NOT NULL;