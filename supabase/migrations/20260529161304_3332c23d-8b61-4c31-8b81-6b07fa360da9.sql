-- Add column for tracked notified users on attachment upload
ALTER TABLE public.projeto_tarefa_anexos
  ADD COLUMN IF NOT EXISTS notificados uuid[] NOT NULL DEFAULT '{}';

-- Trigger function: emit task_mention notifications for each notified user
CREATE OR REPLACE FUNCTION public.notify_anexo_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_uploader_name text;
  v_tarefa_titulo text;
  v_projeto_id uuid;
  v_action_url text;
BEGIN
  IF NEW.notificados IS NULL OR array_length(NEW.notificados, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT COALESCE(p.nome, p.email, 'Alguém')
      INTO v_uploader_name
      FROM public.profiles p
      WHERE p.id = NEW.user_id;

    SELECT t.titulo, t.projeto_id
      INTO v_tarefa_titulo, v_projeto_id
      FROM public.projeto_tarefas t
      WHERE t.id = NEW.tarefa_id;

    v_action_url := '/dashboard/projetos/' || COALESCE(v_projeto_id::text, '') || '?tarefa=' || NEW.tarefa_id::text;

    FOREACH v_uid IN ARRAY NEW.notificados LOOP
      IF v_uid IS NULL OR v_uid = NEW.user_id THEN
        CONTINUE;
      END IF;
      INSERT INTO public.notifications (user_id, type, title, message, action_url, read)
      VALUES (
        v_uid,
        'task_mention',
        'Você foi marcado em um anexo',
        COALESCE(v_uploader_name, 'Alguém') || ' anexou "' || NEW.nome || '"'
          || COALESCE(' em ' || v_tarefa_titulo, ''),
        v_action_url,
        false
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- Never block the upload due to notification failure
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_anexo_mentions ON public.projeto_tarefa_anexos;
CREATE TRIGGER trg_notify_anexo_mentions
AFTER INSERT ON public.projeto_tarefa_anexos
FOR EACH ROW
EXECUTE FUNCTION public.notify_anexo_mentions();