-- 1. New columns on projeto_tarefas
ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS canal_criacao text,
  ADD COLUMN IF NOT EXISTS is_subtask boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_projeto text;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_canal_criacao
  ON public.projeto_tarefas (projeto_id, canal_criacao)
  WHERE canal_criacao IS NOT NULL AND excluida_em IS NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_is_subtask
  ON public.projeto_tarefas (projeto_id, is_subtask)
  WHERE excluida_em IS NULL;

-- 2. Trigger to keep is_subtask in sync with parent_tarefa_id
CREATE OR REPLACE FUNCTION public.projeto_tarefas_set_is_subtask()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_subtask := NEW.parent_tarefa_id IS NOT NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projeto_tarefas_set_is_subtask ON public.projeto_tarefas;
CREATE TRIGGER trg_projeto_tarefas_set_is_subtask
  BEFORE INSERT OR UPDATE OF parent_tarefa_id ON public.projeto_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.projeto_tarefas_set_is_subtask();

-- 3. Followers table
CREATE TABLE IF NOT EXISTS public.projeto_tarefa_seguidores (
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  asana_gid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tarefa_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_seguidores_user
  ON public.projeto_tarefa_seguidores (user_id);

CREATE INDEX IF NOT EXISTS idx_projeto_tarefa_seguidores_asana
  ON public.projeto_tarefa_seguidores (asana_gid)
  WHERE asana_gid IS NOT NULL;

ALTER TABLE public.projeto_tarefa_seguidores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read followers" ON public.projeto_tarefa_seguidores;
CREATE POLICY "Members can read followers"
  ON public.projeto_tarefa_seguidores
  FOR SELECT TO authenticated
  USING (public.user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

DROP POLICY IF EXISTS "Members can insert followers" ON public.projeto_tarefa_seguidores;
CREATE POLICY "Members can insert followers"
  ON public.projeto_tarefa_seguidores
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));

DROP POLICY IF EXISTS "Members can delete followers" ON public.projeto_tarefa_seguidores;
CREATE POLICY "Members can delete followers"
  ON public.projeto_tarefa_seguidores
  FOR DELETE TO authenticated
  USING (public.user_can_access_projeto_via_tarefa(auth.uid(), tarefa_id));