
-- Function to create notification when task is assigned
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_criador_nome TEXT;
  v_projeto_nome TEXT;
BEGIN
  -- Only fire when responsavel_id is set and differs from the creator/updater
  IF NEW.responsavel_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- On INSERT: notify if responsavel != criador
  -- On UPDATE: notify only if responsavel_id changed
  IF TG_OP = 'INSERT' THEN
    IF NEW.responsavel_id = NEW.criador_id THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.responsavel_id IS NOT DISTINCT FROM NEW.responsavel_id THEN
      RETURN NEW;
    END IF;
    -- Don't notify if user assigned to themselves
    -- We can't know who did the update in a trigger, so we skip self-assignment check on UPDATE
  END IF;

  -- Get creator name
  SELECT nome INTO v_criador_nome
  FROM public.profiles
  WHERE id = NEW.criador_id
  LIMIT 1;

  -- Get project name
  SELECT p.nome INTO v_projeto_nome
  FROM public.projetos p
  JOIN public.projeto_secoes ps ON ps.projeto_id = p.id
  WHERE ps.id = NEW.secao_id
  LIMIT 1;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  VALUES (
    NEW.responsavel_id,
    'task_assigned',
    '📋 Nova tarefa atribuída',
    COALESCE(v_criador_nome, 'Alguém') || ' atribuiu a tarefa "' || LEFT(NEW.titulo, 60) || '" a você' ||
      CASE WHEN v_projeto_nome IS NOT NULL THEN ' no projeto ' || v_projeto_nome ELSE '' END,
    '/projetos/' || (
      SELECT p.id FROM public.projetos p
      JOIN public.projeto_secoes ps ON ps.projeto_id = p.id
      WHERE ps.id = NEW.secao_id
      LIMIT 1
    )
  );

  RETURN NEW;
END;
$$;

-- Trigger on projeto_tarefas
CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT OR UPDATE OF responsavel_id ON public.projeto_tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assigned();
