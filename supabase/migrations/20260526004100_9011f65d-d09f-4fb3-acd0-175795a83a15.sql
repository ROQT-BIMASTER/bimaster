ALTER TABLE public.briefings
  ADD COLUMN IF NOT EXISTS tarefa_id uuid NULL
    REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_briefings_tarefa
  ON public.briefings(tarefa_id)
  WHERE tarefa_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_briefings_validar_tarefa_projeto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto uuid;
BEGIN
  IF NEW.tarefa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT projeto_id INTO v_projeto
  FROM public.projeto_tarefas
  WHERE id = NEW.tarefa_id;

  IF v_projeto IS NULL THEN
    RAISE EXCEPTION 'Tarefa % não encontrada', NEW.tarefa_id;
  END IF;

  IF NEW.projeto_id IS NULL THEN
    NEW.projeto_id := v_projeto;
  ELSIF NEW.projeto_id <> v_projeto THEN
    RAISE EXCEPTION 'A tarefa selecionada pertence a outro projeto';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_briefings_validar_tarefa_projeto ON public.briefings;
CREATE TRIGGER trg_briefings_validar_tarefa_projeto
  BEFORE INSERT OR UPDATE OF tarefa_id, projeto_id ON public.briefings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_briefings_validar_tarefa_projeto();