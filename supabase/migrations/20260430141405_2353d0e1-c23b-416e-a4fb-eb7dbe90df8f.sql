-- 1. Preferência de visibilidade do card "Visão geral por papel"
ALTER TABLE public.user_central_preferences
  ADD COLUMN IF NOT EXISTS show_role_overview boolean NOT NULL DEFAULT true;

-- 2. Função de notificação ao mudar papel em tarefa
CREATE OR REPLACE FUNCTION public.notify_tarefa_papel_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_projeto text;
  v_msg text;
  v_url text;
BEGIN
  -- Não notifica quem é o ator da própria mudança
  IF NEW.ator_id IS NOT NULL AND NEW.ator_id = NEW.user_afetado_id THEN
    RETURN NEW;
  END IF;

  SELECT t.titulo, p.nome
    INTO v_titulo, v_projeto
    FROM public.projeto_tarefas t
    JOIN public.projetos p ON p.id = t.projeto_id
   WHERE t.id = NEW.tarefa_id;

  IF v_titulo IS NULL THEN
    RETURN NEW;
  END IF;

  v_url := '/dashboard/projetos/central?tab=tarefas&task=' || NEW.tarefa_id::text;

  v_msg := CASE
    WHEN NEW.papel_novo = 'responsavel' AND NEW.papel_anterior = 'colaborador'
      THEN 'Você passou de colaborador a responsável em "' || v_titulo || '" (' || v_projeto || ').'
    WHEN NEW.papel_novo = 'colaborador' AND NEW.papel_anterior = 'responsavel'
      THEN 'Você passou de responsável a colaborador em "' || v_titulo || '" (' || v_projeto || ').'
    WHEN NEW.papel_novo = 'responsavel'
      THEN 'Você é o novo responsável por "' || v_titulo || '" (' || v_projeto || ').'
    WHEN NEW.papel_novo = 'colaborador'
      THEN 'Você foi adicionado como colaborador em "' || v_titulo || '" (' || v_projeto || ').'
    WHEN NEW.papel_novo IS NULL
      THEN 'Seu acesso à tarefa "' || v_titulo || '" foi removido.'
  END;

  IF v_msg IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (NEW.user_afetado_id, 'task_role_change', 'Mudança de papel em tarefa', v_msg, v_url);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tarefa_papel_change ON public.projeto_tarefa_acesso_audit;
CREATE TRIGGER trg_notify_tarefa_papel_change
  AFTER INSERT ON public.projeto_tarefa_acesso_audit
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tarefa_papel_change();