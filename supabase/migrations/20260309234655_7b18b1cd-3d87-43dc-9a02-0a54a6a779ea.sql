
-- 1. Harden RLS for projeto_tarefa_aprovacoes (DROP permissive policies and create restrictive ones)
DROP POLICY IF EXISTS "Authenticated users can insert aprovacoes" ON public.projeto_tarefa_aprovacoes;
DROP POLICY IF EXISTS "Authenticated users can update aprovacoes" ON public.projeto_tarefa_aprovacoes;
DROP POLICY IF EXISTS "Authenticated users can delete aprovacoes" ON public.projeto_tarefa_aprovacoes;

CREATE POLICY "Members can insert aprovacoes"
ON public.projeto_tarefa_aprovacoes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    JOIN public.projeto_membros pm ON pm.projeto_id = pt.projeto_id
    WHERE pt.id = tarefa_id
    AND pm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    JOIN public.projetos p ON p.id = pt.projeto_id
    WHERE pt.id = tarefa_id
    AND p.criador_id = auth.uid()
  )
);

CREATE POLICY "Members can update aprovacoes"
ON public.projeto_tarefa_aprovacoes
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    JOIN public.projeto_membros pm ON pm.projeto_id = pt.projeto_id
    WHERE pt.id = projeto_tarefa_aprovacoes.tarefa_id
    AND pm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    JOIN public.projetos p ON p.id = pt.projeto_id
    WHERE pt.id = projeto_tarefa_aprovacoes.tarefa_id
    AND p.criador_id = auth.uid()
  )
);

CREATE POLICY "Members can delete aprovacoes"
ON public.projeto_tarefa_aprovacoes
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    JOIN public.projeto_membros pm ON pm.projeto_id = pt.projeto_id
    WHERE pt.id = projeto_tarefa_aprovacoes.tarefa_id
    AND pm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    JOIN public.projetos p ON p.id = pt.projeto_id
    WHERE pt.id = projeto_tarefa_aprovacoes.tarefa_id
    AND p.criador_id = auth.uid()
  )
);

-- 2. Activity log table for task changes
CREATE TABLE public.projeto_tarefa_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  user_id uuid,
  tipo text NOT NULL, -- 'status_change', 'responsavel_change', 'prazo_change', 'estagio_change', 'criacao', 'retrabalho'
  campo text,
  valor_anterior text,
  valor_novo text,
  descricao text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.projeto_tarefa_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view atividades"
ON public.projeto_tarefa_atividades
FOR SELECT TO authenticated
USING (
  public.user_can_access_projeto(auth.uid(), projeto_id)
);

CREATE POLICY "Members can insert atividades"
ON public.projeto_tarefa_atividades
FOR INSERT TO authenticated
WITH CHECK (
  public.user_can_access_projeto(auth.uid(), projeto_id)
);

-- 3. Trigger to auto-log task changes
CREATE OR REPLACE FUNCTION public.log_projeto_tarefa_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, campo, valor_anterior, valor_novo, descricao)
    VALUES (NEW.id, NEW.projeto_id, auth.uid(), 'status_change', 'status', OLD.status, NEW.status,
      'Status alterado de ' || COALESCE(OLD.status, 'vazio') || ' para ' || NEW.status);
  END IF;

  -- Responsavel change
  IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
    INSERT INTO projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, campo, valor_anterior, valor_novo, descricao)
    VALUES (NEW.id, NEW.projeto_id, auth.uid(), 'responsavel_change', 'responsavel_id', OLD.responsavel_id::text, NEW.responsavel_id::text,
      'Responsável alterado');
  END IF;

  -- Prazo change
  IF OLD.data_prazo IS DISTINCT FROM NEW.data_prazo THEN
    INSERT INTO projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, campo, valor_anterior, valor_novo, descricao)
    VALUES (NEW.id, NEW.projeto_id, auth.uid(), 'prazo_change', 'data_prazo', OLD.data_prazo, NEW.data_prazo,
      'Prazo alterado');
  END IF;

  -- Estagio change
  IF OLD.estagio IS DISTINCT FROM NEW.estagio THEN
    INSERT INTO projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, campo, valor_anterior, valor_novo, descricao)
    VALUES (NEW.id, NEW.projeto_id, auth.uid(), 'estagio_change', 'estagio', OLD.estagio, NEW.estagio,
      'Estágio alterado de ' || COALESCE(OLD.estagio, 'vazio') || ' para ' || COALESCE(NEW.estagio, 'vazio'));
  END IF;

  -- Tipo tarefa (retrabalho)
  IF OLD.tipo_tarefa IS DISTINCT FROM NEW.tipo_tarefa THEN
    INSERT INTO projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, campo, valor_anterior, valor_novo, descricao)
    VALUES (NEW.id, NEW.projeto_id, auth.uid(), 'retrabalho', 'tipo_tarefa', OLD.tipo_tarefa, NEW.tipo_tarefa,
      CASE WHEN NEW.tipo_tarefa = 'retrabalho' THEN 'Marcada como retrabalho' ELSE 'Desmarcada como retrabalho' END);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_log_projeto_tarefa_changes
  AFTER UPDATE ON public.projeto_tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.log_projeto_tarefa_changes();

-- 4. Task dependencies table
CREATE TABLE public.projeto_tarefa_dependencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  depende_de_id uuid NOT NULL REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  tipo text DEFAULT 'finish_to_start', -- 'finish_to_start', 'start_to_start'
  created_at timestamptz DEFAULT now(),
  UNIQUE(tarefa_id, depende_de_id)
);

ALTER TABLE public.projeto_tarefa_dependencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view dependencias"
ON public.projeto_tarefa_dependencias
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    WHERE pt.id = projeto_tarefa_dependencias.tarefa_id
    AND public.user_can_access_projeto(auth.uid(), pt.projeto_id)
  )
);

CREATE POLICY "Members can manage dependencias"
ON public.projeto_tarefa_dependencias
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projeto_tarefas pt
    WHERE pt.id = projeto_tarefa_dependencias.tarefa_id
    AND public.user_can_access_projeto(auth.uid(), pt.projeto_id)
  )
);
