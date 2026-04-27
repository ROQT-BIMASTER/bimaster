-- 1) Permitir admins/gerentes adicionarem e removerem membros de qualquer projeto
DROP POLICY IF EXISTS "Coordinators manage members" ON public.projeto_membros;
DROP POLICY IF EXISTS "Coordinators delete members" ON public.projeto_membros;

CREATE POLICY "Manage project members"
ON public.projeto_membros
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR EXISTS (
    SELECT 1 FROM public.projetos
    WHERE id = projeto_membros.projeto_id AND criador_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projeto_membros pm2
    WHERE pm2.projeto_id = projeto_membros.projeto_id
      AND pm2.user_id = auth.uid()
      AND pm2.papel IN ('coordenador','gestor_produto')
  )
);

CREATE POLICY "Delete project members"
ON public.projeto_membros
FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gerente')
  OR EXISTS (
    SELECT 1 FROM public.projetos
    WHERE id = projeto_membros.projeto_id AND criador_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projeto_membros pm2
    WHERE pm2.projeto_id = projeto_membros.projeto_id
      AND pm2.user_id = auth.uid()
      AND pm2.papel IN ('coordenador','gestor_produto')
      AND pm2.id <> projeto_membros.id
  )
);

-- 2) Suportar status 'cancelada' nas tarefas — relaxar validação hierárquica para canceladas
CREATE OR REPLACE FUNCTION public.validate_tarefa_prazo_hierarquia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_prazo DATE;
  v_secao_prazo DATE;
  v_projeto_prazo DATE;
BEGIN
  -- Tarefas canceladas não validam hierarquia de prazos
  IF NEW.status = 'cancelada' THEN
    RETURN NEW;
  END IF;

  IF NEW.data_prazo IS NULL THEN
    RETURN NEW;
  END IF;

  -- Subtarefa ≤ tarefa pai
  IF NEW.parent_id IS NOT NULL THEN
    SELECT data_prazo INTO v_parent_prazo
    FROM public.projeto_tarefas
    WHERE id = NEW.parent_id;
    IF v_parent_prazo IS NOT NULL AND NEW.data_prazo > v_parent_prazo THEN
      RAISE EXCEPTION 'O prazo da subtarefa (%) não pode ultrapassar o prazo da tarefa pai (%)',
        NEW.data_prazo, v_parent_prazo;
    END IF;
  END IF;

  -- Tarefa ≤ seção
  IF NEW.secao_id IS NOT NULL THEN
    SELECT data_prazo INTO v_secao_prazo
    FROM public.projeto_secoes
    WHERE id = NEW.secao_id;
    IF v_secao_prazo IS NOT NULL AND NEW.data_prazo > v_secao_prazo THEN
      RAISE EXCEPTION 'O prazo da tarefa (%) não pode ultrapassar o prazo da seção (%)',
        NEW.data_prazo, v_secao_prazo;
    END IF;
  END IF;

  -- Tarefa ≤ projeto
  IF NEW.projeto_id IS NOT NULL THEN
    SELECT data_prazo_geral INTO v_projeto_prazo
    FROM public.projetos
    WHERE id = NEW.projeto_id;
    IF v_projeto_prazo IS NOT NULL AND NEW.data_prazo > v_projeto_prazo THEN
      RAISE EXCEPTION 'O prazo da tarefa (%) não pode ultrapassar o prazo do projeto (%)',
        NEW.data_prazo, v_projeto_prazo;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;