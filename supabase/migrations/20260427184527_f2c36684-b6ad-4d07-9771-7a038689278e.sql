-- 1. Adicionar campos de prazo às seções
ALTER TABLE public.projeto_secoes
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_prazo date,
  ADD COLUMN IF NOT EXISTS dias_alerta_antes integer NOT NULL DEFAULT 2;

-- 2. Trigger de validação de hierarquia de prazos para SEÇÕES
CREATE OR REPLACE FUNCTION public.validate_secao_prazo_hierarquia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proj_inicio date;
  v_proj_fim date;
BEGIN
  IF NEW.data_inicio IS NOT NULL AND NEW.data_prazo IS NOT NULL
     AND NEW.data_inicio > NEW.data_prazo THEN
    RAISE EXCEPTION 'A data de início da seção não pode ser posterior à data de prazo.';
  END IF;

  IF NEW.data_prazo IS NOT NULL THEN
    SELECT data_inicio, data_fim_alvo INTO v_proj_inicio, v_proj_fim
    FROM public.projetos WHERE id = NEW.projeto_id;

    IF v_proj_fim IS NOT NULL AND NEW.data_prazo > v_proj_fim THEN
      RAISE EXCEPTION 'O prazo da seção (%) não pode ultrapassar o prazo do projeto (%).',
        to_char(NEW.data_prazo, 'DD/MM/YYYY'), to_char(v_proj_fim, 'DD/MM/YYYY');
    END IF;

    IF v_proj_inicio IS NOT NULL AND NEW.data_prazo < v_proj_inicio THEN
      RAISE EXCEPTION 'O prazo da seção (%) não pode ser anterior ao início do projeto (%).',
        to_char(NEW.data_prazo, 'DD/MM/YYYY'), to_char(v_proj_inicio, 'DD/MM/YYYY');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_secao_prazo_hierarquia ON public.projeto_secoes;
CREATE TRIGGER trg_validate_secao_prazo_hierarquia
BEFORE INSERT OR UPDATE OF data_inicio, data_prazo ON public.projeto_secoes
FOR EACH ROW EXECUTE FUNCTION public.validate_secao_prazo_hierarquia();

-- 3. Trigger de validação de hierarquia de prazos para TAREFAS / SUBTAREFAS
CREATE OR REPLACE FUNCTION public.validate_tarefa_prazo_hierarquia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secao_prazo date;
  v_proj_fim date;
  v_parent_prazo date;
BEGIN
  IF NEW.data_inicio_planejada IS NOT NULL AND NEW.data_prazo IS NOT NULL
     AND NEW.data_inicio_planejada > NEW.data_prazo THEN
    RAISE EXCEPTION 'A data de início planejada não pode ser posterior à data de prazo.';
  END IF;

  IF NEW.data_prazo IS NOT NULL THEN
    -- Subtarefa: validar contra tarefa-pai
    IF NEW.parent_tarefa_id IS NOT NULL THEN
      SELECT data_prazo INTO v_parent_prazo
      FROM public.projeto_tarefas WHERE id = NEW.parent_tarefa_id;

      IF v_parent_prazo IS NOT NULL AND NEW.data_prazo > v_parent_prazo THEN
        RAISE EXCEPTION 'O prazo da subtarefa (%) não pode ultrapassar o prazo da tarefa pai (%).',
          to_char(NEW.data_prazo, 'DD/MM/YYYY'), to_char(v_parent_prazo, 'DD/MM/YYYY');
      END IF;
    ELSE
      -- Tarefa raiz: validar contra seção e projeto
      SELECT data_prazo INTO v_secao_prazo
      FROM public.projeto_secoes WHERE id = NEW.secao_id;

      IF v_secao_prazo IS NOT NULL AND NEW.data_prazo > v_secao_prazo THEN
        RAISE EXCEPTION 'O prazo da tarefa (%) não pode ultrapassar o prazo da seção (%).',
          to_char(NEW.data_prazo, 'DD/MM/YYYY'), to_char(v_secao_prazo, 'DD/MM/YYYY');
      END IF;

      SELECT data_fim_alvo INTO v_proj_fim
      FROM public.projetos WHERE id = NEW.projeto_id;

      IF v_proj_fim IS NOT NULL AND NEW.data_prazo > v_proj_fim THEN
        RAISE EXCEPTION 'O prazo da tarefa (%) não pode ultrapassar o prazo do projeto (%).',
          to_char(NEW.data_prazo, 'DD/MM/YYYY'), to_char(v_proj_fim, 'DD/MM/YYYY');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_tarefa_prazo_hierarquia ON public.projeto_tarefas;
CREATE TRIGGER trg_validate_tarefa_prazo_hierarquia
BEFORE INSERT OR UPDATE OF data_inicio_planejada, data_prazo, parent_tarefa_id, secao_id ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.validate_tarefa_prazo_hierarquia();