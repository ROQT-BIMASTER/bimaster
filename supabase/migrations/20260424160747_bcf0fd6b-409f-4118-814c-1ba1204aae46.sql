-- 1) Função para sincronizar data_conclusao com mudança de status
CREATE OR REPLACE FUNCTION public.sync_tarefa_data_conclusao()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Insert: se já vem como concluida e sem data, registra agora
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'concluida' AND NEW.data_conclusao IS NULL THEN
      NEW.data_conclusao := now();
    END IF;
    RETURN NEW;
  END IF;

  -- Update: detecta transições de status
  IF TG_OP = 'UPDATE' THEN
    -- Passou a ser concluida
    IF NEW.status = 'concluida' AND COALESCE(OLD.status, '') <> 'concluida' THEN
      IF NEW.data_conclusao IS NULL THEN
        NEW.data_conclusao := now();
      END IF;
    -- Saiu de concluida
    ELSIF NEW.status <> 'concluida' AND COALESCE(OLD.status, '') = 'concluida' THEN
      NEW.data_conclusao := NULL;
    -- Continua concluida mas vieram sem data: preserva a anterior
    ELSIF NEW.status = 'concluida' AND NEW.data_conclusao IS NULL AND OLD.data_conclusao IS NOT NULL THEN
      NEW.data_conclusao := OLD.data_conclusao;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_sync_tarefa_data_conclusao ON public.projeto_tarefas;
CREATE TRIGGER trg_sync_tarefa_data_conclusao
BEFORE INSERT OR UPDATE OF status, data_conclusao
ON public.projeto_tarefas
FOR EACH ROW
EXECUTE FUNCTION public.sync_tarefa_data_conclusao();

-- 3) Backfill retroativo das tarefas concluídas sem data_conclusao
UPDATE public.projeto_tarefas
SET data_conclusao = COALESCE(updated_at, created_at, now())
WHERE status = 'concluida'
  AND data_conclusao IS NULL;