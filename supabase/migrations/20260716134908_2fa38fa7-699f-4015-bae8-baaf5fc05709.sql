
DROP TRIGGER IF EXISTS trg_sync_tarefa_responsavel_from_tarefa ON public.projeto_tarefas;
DROP TRIGGER IF EXISTS trg_sync_tarefa_responsavel_from_nn ON public.projeto_tarefa_responsaveis;
DROP FUNCTION IF EXISTS public.sync_tarefa_responsavel_from_tarefa();
DROP FUNCTION IF EXISTS public.sync_tarefa_responsavel_from_nn();

CREATE OR REPLACE FUNCTION public.sync_tarefa_responsavel_from_tarefa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    IF NEW.responsavel_id IS NOT NULL THEN
      INSERT INTO public.projeto_tarefa_responsaveis (tarefa_id, user_id, papel, criado_por)
      VALUES (NEW.id, NEW.responsavel_id, 'responsavel', COALESCE(auth.uid(), NEW.responsavel_id))
      ON CONFLICT (tarefa_id, user_id) DO NOTHING;
    END IF;
    SELECT id INTO v_ticket_id FROM public.suporte_tickets WHERE projeto_tarefa_id = NEW.id LIMIT 1;
    IF v_ticket_id IS NOT NULL THEN
      UPDATE public.suporte_tickets SET assignee_id = NEW.responsavel_id, updated_at = now()
       WHERE id = v_ticket_id AND assignee_id IS DISTINCT FROM NEW.responsavel_id;
    END IF;
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_sync_tarefa_responsavel_from_tarefa
AFTER UPDATE OF responsavel_id ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.sync_tarefa_responsavel_from_tarefa();

-- Backfill 1
UPDATE public.projeto_tarefas t
SET responsavel_id = sub.user_id,
    updated_at = now()
FROM (
  SELECT DISTINCT ON (r.tarefa_id) r.tarefa_id, r.user_id
  FROM public.projeto_tarefa_responsaveis r
  WHERE r.papel = 'responsavel'
  ORDER BY r.tarefa_id, r.created_at ASC NULLS LAST
) sub
WHERE t.id = sub.tarefa_id
  AND t.excluida_em IS NULL
  AND t.responsavel_id IS NULL;

-- Backfill 2
INSERT INTO public.projeto_tarefa_responsaveis (tarefa_id, user_id, papel, criado_por)
SELECT t.id, t.responsavel_id, 'responsavel', t.responsavel_id
FROM public.projeto_tarefas t
WHERE t.excluida_em IS NULL
  AND t.responsavel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.projeto_tarefa_responsaveis r
    WHERE r.tarefa_id = t.id AND r.user_id = t.responsavel_id
  )
ON CONFLICT (tarefa_id, user_id) DO NOTHING;
