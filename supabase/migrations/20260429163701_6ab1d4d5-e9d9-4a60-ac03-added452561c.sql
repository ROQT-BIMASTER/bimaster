CREATE OR REPLACE FUNCTION public.validate_tarefa_prazo_hierarquia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_parent_prazo DATE;
  v_secao_prazo DATE;
  v_projeto_prazo DATE;
BEGIN
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  IF NEW.data_prazo IS NULL THEN
    RETURN NEW;
  END IF;

  -- Subtarefa <= tarefa pai
  IF NEW.parent_tarefa_id IS NOT NULL THEN
    SELECT data_prazo INTO v_parent_prazo
    FROM public.projeto_tarefas
    WHERE id = NEW.parent_tarefa_id;
    IF v_parent_prazo IS NOT NULL AND NEW.data_prazo > v_parent_prazo THEN
      RAISE EXCEPTION 'O prazo da subtarefa (%) não pode ultrapassar o prazo da tarefa pai (%)',
        NEW.data_prazo, v_parent_prazo;
    END IF;
  END IF;

  -- Tarefa <= seção
  IF NEW.secao_id IS NOT NULL THEN
    SELECT data_prazo INTO v_secao_prazo
    FROM public.projeto_secoes
    WHERE id = NEW.secao_id;
    IF v_secao_prazo IS NOT NULL AND NEW.data_prazo > v_secao_prazo THEN
      RAISE EXCEPTION 'O prazo da tarefa (%) não pode ultrapassar o prazo da seção (%)',
        NEW.data_prazo, v_secao_prazo;
    END IF;
  END IF;

  -- Tarefa <= projeto
  IF NEW.projeto_id IS NOT NULL THEN
    SELECT data_fim_alvo INTO v_projeto_prazo
    FROM public.projetos
    WHERE id = NEW.projeto_id;
    IF v_projeto_prazo IS NOT NULL AND NEW.data_prazo > v_projeto_prazo THEN
      RAISE EXCEPTION 'O prazo da tarefa (%) não pode ultrapassar o prazo do projeto (%)',
        NEW.data_prazo, v_projeto_prazo;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;