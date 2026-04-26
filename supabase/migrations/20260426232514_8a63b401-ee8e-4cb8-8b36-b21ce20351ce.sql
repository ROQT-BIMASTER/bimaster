-- Trigger: garante que apenas membros do projeto sejam atribuídos como responsáveis ou seguidores

-- 1. Validador para projeto_tarefas.responsavel_id
CREATE OR REPLACE FUNCTION public.validate_tarefa_responsavel_membro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_id uuid;
  v_is_membro boolean;
  v_is_criador boolean;
BEGIN
  IF NEW.responsavel_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_projeto_id := NEW.projeto_id;
  IF v_projeto_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.projeto_membros
    WHERE projeto_id = v_projeto_id AND user_id = NEW.responsavel_id
  ) INTO v_is_membro;

  SELECT EXISTS(
    SELECT 1 FROM public.projetos
    WHERE id = v_projeto_id AND criado_por = NEW.responsavel_id
  ) INTO v_is_criador;

  IF NOT v_is_membro AND NOT v_is_criador THEN
    RAISE EXCEPTION 'Apenas membros cadastrados no projeto podem ser atribuídos como responsável da tarefa.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_tarefa_responsavel ON public.projeto_tarefas;
CREATE TRIGGER trg_validate_tarefa_responsavel
BEFORE INSERT OR UPDATE OF responsavel_id ON public.projeto_tarefas
FOR EACH ROW
EXECUTE FUNCTION public.validate_tarefa_responsavel_membro();

-- 2. Validador para projeto_tarefa_colaboradores.user_id
CREATE OR REPLACE FUNCTION public.validate_tarefa_colaborador_membro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_id uuid;
  v_is_membro boolean;
  v_is_criador boolean;
BEGIN
  SELECT projeto_id INTO v_projeto_id
  FROM public.projeto_tarefas
  WHERE id = NEW.tarefa_id;

  IF v_projeto_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.projeto_membros
    WHERE projeto_id = v_projeto_id AND user_id = NEW.user_id
  ) INTO v_is_membro;

  SELECT EXISTS(
    SELECT 1 FROM public.projetos
    WHERE id = v_projeto_id AND criado_por = NEW.user_id
  ) INTO v_is_criador;

  IF NOT v_is_membro AND NOT v_is_criador THEN
    RAISE EXCEPTION 'Apenas membros cadastrados no projeto podem ser adicionados como seguidores da tarefa.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_tarefa_colaborador ON public.projeto_tarefa_colaboradores;
CREATE TRIGGER trg_validate_tarefa_colaborador
BEFORE INSERT OR UPDATE ON public.projeto_tarefa_colaboradores
FOR EACH ROW
EXECUTE FUNCTION public.validate_tarefa_colaborador_membro();