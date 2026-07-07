
CREATE OR REPLACE FUNCTION public.tg_lock_prazo_tarefa_espelhada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_espelho boolean;
  v_bypass text;
BEGIN
  -- Só interessa se datas mudaram
  IF NEW.data_prazo IS NOT DISTINCT FROM OLD.data_prazo
     AND NEW.data_inicio_planejada IS NOT DISTINCT FROM OLD.data_inicio_planejada THEN
    RETURN NEW;
  END IF;

  -- Bypass usado pelos triggers de sincronização SLA (SET LOCAL app.allow_sla_sync = 'on')
  BEGIN
    v_bypass := current_setting('app.allow_sla_sync', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;

  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  -- É tarefa espelhada de processo?
  SELECT EXISTS (
    SELECT 1 FROM public.processo_tarefa_espelho e
    WHERE e.projeto_tarefa_id = NEW.id
  ) INTO v_has_espelho;

  IF v_has_espelho THEN
    RAISE EXCEPTION USING
      ERRCODE = 'check_violation',
      MESSAGE = 'Prazo travado pelo processo operacional. Ajuste o SLA da etapa no cadastro do processo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_prazo_tarefa_espelhada ON public.projeto_tarefas;
CREATE TRIGGER trg_lock_prazo_tarefa_espelhada
BEFORE UPDATE OF data_prazo, data_inicio_planejada ON public.projeto_tarefas
FOR EACH ROW
EXECUTE FUNCTION public.tg_lock_prazo_tarefa_espelhada();
