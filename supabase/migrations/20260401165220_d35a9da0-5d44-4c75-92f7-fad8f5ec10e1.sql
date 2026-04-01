
-- Audit trigger function for projeto_tarefas
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
BEGIN
  v_user_id := auth.uid();
  
  -- Get user name
  SELECT nome INTO v_user_nome FROM public.profiles WHERE id = v_user_id LIMIT 1;
  IF v_user_nome IS NULL THEN v_user_nome := 'Sistema'; END IF;

  -- INSERT = task creation
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, COALESCE(v_user_id, NEW.criador_id), 'criacao', 'Criou a tarefa "' || LEFT(NEW.titulo, 80) || '"', 'tarefa', NULL, NEW.titulo);
    RETURN NEW;
  END IF;

  -- UPDATE: check each field
  -- Status
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_user_id, 'status_change', 'Alterou status', 'status', OLD.status, NEW.status);
  END IF;

  -- Prioridade
  IF OLD.prioridade IS DISTINCT FROM NEW.prioridade THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_user_id, 'prioridade_change', 'Alterou prioridade', 'prioridade', OLD.prioridade, NEW.prioridade);
  END IF;

  -- Estágio
  IF OLD.estagio IS DISTINCT FROM NEW.estagio THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_user_id, 'estagio_change', 'Alterou estágio', 'estagio', OLD.estagio, NEW.estagio);
  END IF;

  -- Responsável
  IF OLD.responsavel_id IS DISTINCT FROM NEW.responsavel_id THEN
    SELECT nome INTO v_resp_nome FROM public.profiles WHERE id = NEW.responsavel_id LIMIT 1;
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_user_id, 'responsavel_change', 'Atribuiu responsável ' || COALESCE(v_resp_nome, 'removido'), 'responsavel_id', OLD.responsavel_id::text, NEW.responsavel_id::text);
  END IF;

  -- Prazo
  IF OLD.data_prazo IS DISTINCT FROM NEW.data_prazo THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_user_id, 'prazo_change', 'Alterou prazo', 'data_prazo', OLD.data_prazo::text, NEW.data_prazo::text);
  END IF;

  -- Título
  IF OLD.titulo IS DISTINCT FROM NEW.titulo THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_user_id, 'titulo_change', 'Alterou título', 'titulo', LEFT(OLD.titulo, 120), LEFT(NEW.titulo, 120));
  END IF;

  -- Descrição
  IF OLD.descricao IS DISTINCT FROM NEW.descricao THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_user_id, 'descricao_change', 'Alterou descrição', 'descricao', NULL, NULL);
  END IF;

  -- Seção
  IF OLD.secao_id IS DISTINCT FROM NEW.secao_id THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_user_id, 'secao_change', 'Moveu para outra seção', 'secao_id', OLD.secao_id::text, NEW.secao_id::text);
  END IF;

  -- Data início planejada
  IF OLD.data_inicio_planejada IS DISTINCT FROM NEW.data_inicio_planejada THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_user_id, 'inicio_change', 'Alterou início planejado', 'data_inicio_planejada', OLD.data_inicio_planejada::text, NEW.data_inicio_planejada::text);
  END IF;

  -- Validação
  IF OLD.validacao_status IS DISTINCT FROM NEW.validacao_status THEN
    INSERT INTO public.projeto_tarefa_atividades (tarefa_id, user_id, tipo, descricao, campo, valor_anterior, valor_novo)
    VALUES (NEW.id, v_user_id, 'validacao_change', 
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

-- Create trigger
DROP TRIGGER IF EXISTS trg_audit_projeto_tarefa ON public.projeto_tarefas;
CREATE TRIGGER trg_audit_projeto_tarefa
  AFTER INSERT OR UPDATE ON public.projeto_tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_projeto_tarefa_changes();
