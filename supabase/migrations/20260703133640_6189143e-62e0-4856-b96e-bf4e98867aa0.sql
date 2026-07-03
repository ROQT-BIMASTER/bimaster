
-- ALLOW-DESTRUCTIVE: envio de projetos/tarefas Asana para lixeira 30d (BIM-asana-trash-2026-07)

-- 1) Nova coluna deleted_at em projeto_tarefas
ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_not_deleted
  ON public.projeto_tarefas (projeto_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_deleted_at
  ON public.projeto_tarefas (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- 2) Recriar policies acrescentando filtro de lixeira
DROP POLICY IF EXISTS "Users view accessible tasks" ON public.projeto_tarefas;
CREATE POLICY "Users view accessible tasks"
  ON public.projeto_tarefas FOR SELECT
  USING (deleted_at IS NULL AND user_can_access_secao((SELECT auth.uid()), secao_id));

DROP POLICY IF EXISTS "Task owners can view own assigned tasks" ON public.projeto_tarefas;
CREATE POLICY "Task owners can view own assigned tasks"
  ON public.projeto_tarefas FOR SELECT
  USING (
    deleted_at IS NULL
    AND (responsavel_id = (SELECT auth.uid()) OR criador_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Task collaborators can view own collaborated tasks" ON public.projeto_tarefas;
CREATE POLICY "Task collaborators can view own collaborated tasks"
  ON public.projeto_tarefas FOR SELECT
  USING (deleted_at IS NULL AND user_is_task_collaborator((SELECT auth.uid()), id));

DROP POLICY IF EXISTS "Members or assignees can update projeto_tarefas" ON public.projeto_tarefas;
CREATE POLICY "Members or assignees can update projeto_tarefas"
  ON public.projeto_tarefas FOR UPDATE
  USING (
    deleted_at IS NULL AND (
      user_can_access_projeto((SELECT auth.uid()), projeto_id)
      OR responsavel_id = (SELECT auth.uid())
      OR criador_id = (SELECT auth.uid())
      OR EXISTS (SELECT 1 FROM projeto_tarefa_responsaveis r WHERE r.tarefa_id = projeto_tarefas.id AND r.user_id = (SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM projeto_tarefa_colaboradores c WHERE c.tarefa_id = projeto_tarefas.id AND c.user_id = (SELECT auth.uid()))
      OR EXISTS (SELECT 1 FROM projeto_tarefa_seguidores s WHERE s.tarefa_id = projeto_tarefas.id AND s.user_id = (SELECT auth.uid()))
    )
  );

-- 3) Move para lixeira todos os projetos e tarefas vinculados ao Asana
UPDATE public.projeto_tarefas t
  SET deleted_at = now()
  FROM public.projetos p
  WHERE t.projeto_id = p.id
    AND p.asana_gid IS NOT NULL
    AND t.deleted_at IS NULL;

UPDATE public.projetos
  SET deleted_at = now(), bloqueado = true, updated_at = now()
  WHERE asana_gid IS NOT NULL
    AND deleted_at IS NULL;

-- 4) Função de purga (SECURITY DEFINER) — apaga definitivamente após 30 dias na lixeira
CREATE OR REPLACE FUNCTION public.purge_asana_trash_expired()
RETURNS TABLE(projetos_removidos int, tarefas_removidas int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tarefas int := 0;
  v_projetos int := 0;
BEGIN
  WITH exp AS (
    SELECT id FROM public.projetos
    WHERE asana_gid IS NOT NULL
      AND deleted_at IS NOT NULL
      AND deleted_at < now() - interval '30 days'
  ), del_t AS (
    DELETE FROM public.projeto_tarefas
    WHERE projeto_id IN (SELECT id FROM exp)
    RETURNING 1
  )
  SELECT count(*) INTO v_tarefas FROM del_t;

  WITH exp AS (
    SELECT id FROM public.projetos
    WHERE asana_gid IS NOT NULL
      AND deleted_at IS NOT NULL
      AND deleted_at < now() - interval '30 days'
  ), del_p AS (
    DELETE FROM public.projetos
    WHERE id IN (SELECT id FROM exp)
    RETURNING 1
  )
  SELECT count(*) INTO v_projetos FROM del_p;

  RETURN QUERY SELECT v_projetos, v_tarefas;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_asana_trash_expired() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_asana_trash_expired() TO service_role;

-- 5) Agendamento diário 03:00 UTC (pg_cron)
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('purge-asana-trash');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'purge-asana-trash',
  '0 3 * * *',
  $$SELECT public.purge_asana_trash_expired();$$
);
