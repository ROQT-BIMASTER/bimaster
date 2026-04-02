
-- Fix: include projeto_id in all INSERTs into projeto_tarefa_atividades
CREATE OR REPLACE FUNCTION public.audit_projeto_tarefa_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_nome TEXT;
  v_resp_nome TEXT;
  v_projeto_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  SELECT nome INTO v_user_nome FROM public.profiles WHERE id = v_user_id LIMIT 1;
  IF v_user_nome IS NULL THEN v_user_nome := 'Sistema'; END IF;

  -- Determine projeto_id safely
  IF TG_OP = 'INSERT' THEN
    v_projeto_id := NEW.projeto_id;
  ELSE
    v_projeto_id := COALESCE(NEW.projeto_id, OLD.projeto_id);
  END IF;

  -- INSERT = task creation
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, COALESCE(v_user_id, NEW.criador_id), 'criacao', 'Criou a tarefa "' || LEFT(NEW.titulo, 80) || '"', 'tarefa', NULL, NEW.titulo);
    RETURN NEW;
  END IF;

  -- UPDATE: check each field
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, v_user_id, 'status_change', 'Alterou status', 'status', OLD.status, NEW.status);
  END IF;

  IF OLD.prioridade IS DISTINCT FROM NEW.prioridade THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, v_user_id, 'prioridade_change', 'Alterou prioridade', 'prioridade', OLD.prioridade, NEW.prioridade);
  END IF;

  IF OLD.estagio IS DISTINCT FROM NEW.estagio THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, v_user_id, 'estagio_change', 'Alterou estágio', 'estagio', OLD.estagio, NEW.estagio);
  END IF;

  IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
    SELECT nome INTO v_resp_nome FROM public.profiles WHERE id = NEW.responsavel_id LIMIT 1;
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, v_user_id, 'responsavel_change', 'Atribuiu responsável ' || COALESCE(v_resp_nome, 'removido'), 'responsavel_id', OLD.responsavel_id::text, NEW.responsavel_id::text);
  END IF;

  IF OLD.data_prazo IS DISTINCT FROM NEW.data_prazo THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, v_user_id, 'prazo_change', 'Alterou prazo', 'data_prazo', OLD.data_prazo::text, NEW.data_prazo::text);
  END IF;

  IF OLD.titulo IS DISTINCT FROM NEW.titulo THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, v_user_id, 'titulo_change', 'Alterou título', 'titulo', LEFT(OLD.titulo, 120), LEFT(NEW.titulo, 120));
  END IF;

  IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, v_user_id, 'descricao_change', 'Alterou descrição', 'descricao', NULL, NULL);
  END IF;

  IF OLD.secao_id IS DISTINCT FROM NEW.secao_id THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, v_user_id, 'secao_change', 'Moveu para outra seção', 'secao_id', OLD.secao_id::text, NEW.secao_id::text);
  END IF;

  IF OLD.data_inicio_planejada IS DISTINCT FROM NEW.data_inicio_planejada THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, v_user_id, 'inicio_change', 'Alterou início planejado', 'data_inicio_planejada', OLD.data_inicio_planejada::text, NEW.data_inicio_planejada::text);
  END IF;

  IF OLD.validacao_status IS DISTINCT FROM NEW.validacao_status THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, projeto_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_projeto_id, v_user_id, 'validacao_change', 
      CASE NEW.validacao_status 
        WHEN 'pendente' THEN 'Enviou para validação'
        WHEN 'aprovada' THEN 'Validou a tarefa'
        WHEN 'rejeitada' THEN 'Rejeitou a tarefa'
        ELSE 'Alterou validação'
      END,
      'validacao_status', OLD.validacao_status, NEW.validacao_status);
  END IF;

  RETURN NEW;
END;
$$;

-- Remove redundant legacy trigger
DROP TRIGGER IF EXISTS tr_log_projeto_tarefa_changes ON public.projeto_tarefas;
