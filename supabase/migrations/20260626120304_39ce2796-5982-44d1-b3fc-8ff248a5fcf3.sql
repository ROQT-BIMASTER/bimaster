
-- Validate parent_tarefa_id integrity for nested subtasks
CREATE OR REPLACE FUNCTION public.validate_tarefa_parent_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_projeto uuid;
  v_parent_secao uuid;
  v_cycle_check uuid;
  v_depth int := 0;
BEGIN
  IF NEW.parent_tarefa_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_tarefa_id = NEW.id THEN
    RAISE EXCEPTION 'Uma tarefa não pode ser pai de si mesma'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT projeto_id, secao_id
    INTO v_parent_projeto, v_parent_secao
  FROM public.projeto_tarefas
  WHERE id = NEW.parent_tarefa_id;

  IF v_parent_projeto IS NULL THEN
    RAISE EXCEPTION 'Tarefa pai (%) não encontrada', NEW.parent_tarefa_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_parent_projeto <> NEW.projeto_id THEN
    RAISE EXCEPTION 'parent_tarefa_id (%) pertence a outro projeto (% != %)',
      NEW.parent_tarefa_id, v_parent_projeto, NEW.projeto_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Subtarefa herda a seção do pai automaticamente, garantindo consistência.
  IF NEW.secao_id IS DISTINCT FROM v_parent_secao THEN
    NEW.secao_id := v_parent_secao;
  END IF;

  -- Cycle guard (defensivo; árvore deveria ser DAG por construção).
  v_cycle_check := NEW.parent_tarefa_id;
  WHILE v_cycle_check IS NOT NULL AND v_depth < 50 LOOP
    IF v_cycle_check = NEW.id THEN
      RAISE EXCEPTION 'Ciclo detectado na hierarquia de subtarefas'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT parent_tarefa_id INTO v_cycle_check
    FROM public.projeto_tarefas
    WHERE id = v_cycle_check;
    v_depth := v_depth + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_tarefa_parent_integrity ON public.projeto_tarefas;
CREATE TRIGGER trg_validate_tarefa_parent_integrity
  BEFORE INSERT OR UPDATE OF parent_tarefa_id, projeto_id ON public.projeto_tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_tarefa_parent_integrity();
