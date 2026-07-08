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
  IF NEW.data_prazo IS NOT DISTINCT FROM OLD.data_prazo
     AND NEW.data_inicio_planejada IS NOT DISTINCT FROM OLD.data_inicio_planejada THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_bypass := current_setting('app.allow_sla_sync', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;

  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.processo_tarefa_espelho e
    WHERE e.projeto_tarefa_id = NEW.id
  ) INTO v_has_espelho;

  IF v_has_espelho THEN
    -- Soft mode: preserva datas ancoradas ao processo, mas NÃO bloqueia o UPDATE.
    -- Kanban / transferências operacionais concluem normalmente.
    NEW.data_prazo := OLD.data_prazo;
    NEW.data_inicio_planejada := OLD.data_inicio_planejada;
    RAISE NOTICE 'Prazo da tarefa % preservado pelo processo operacional (SLA acompanha).', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;