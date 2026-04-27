CREATE OR REPLACE FUNCTION public.validate_tarefa_responsavel_membro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    WHERE id = v_projeto_id AND criador_id = NEW.responsavel_id
  ) INTO v_is_criador;

  IF NOT v_is_membro AND NOT v_is_criador THEN
    RAISE EXCEPTION 'Apenas membros cadastrados no projeto podem ser atribuídos como responsável da tarefa.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;