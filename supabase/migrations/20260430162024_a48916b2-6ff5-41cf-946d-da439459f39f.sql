-- Realtime para acoes
ALTER TABLE public.projeto_copilot_acoes REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='projeto_copilot_acoes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.projeto_copilot_acoes';
  END IF;
END$$;

-- Função: registra tentativa de senha (anti força-bruta)
CREATE OR REPLACE FUNCTION public.register_copilot_password_attempt(
  _user_id uuid,
  _success boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.projeto_copilot_password_attempts%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_row FROM projeto_copilot_password_attempts WHERE user_id = _user_id;

  IF v_row.user_id IS NULL THEN
    INSERT INTO projeto_copilot_password_attempts(user_id, tentativas, janela_inicio)
    VALUES (_user_id, CASE WHEN _success THEN 0 ELSE 1 END, v_now);
    RETURN jsonb_build_object('blocked', false, 'tentativas', CASE WHEN _success THEN 0 ELSE 1 END);
  END IF;

  -- bloqueio ativo?
  IF v_row.bloqueado_ate IS NOT NULL AND v_row.bloqueado_ate > v_now THEN
    RETURN jsonb_build_object('blocked', true, 'bloqueado_ate', v_row.bloqueado_ate);
  END IF;

  -- janela expirada (15 min)? reset
  IF v_row.janela_inicio < v_now - interval '15 minutes' THEN
    UPDATE projeto_copilot_password_attempts
    SET tentativas = CASE WHEN _success THEN 0 ELSE 1 END,
        janela_inicio = v_now,
        bloqueado_ate = NULL
    WHERE user_id = _user_id;
    RETURN jsonb_build_object('blocked', false, 'tentativas', CASE WHEN _success THEN 0 ELSE 1 END);
  END IF;

  IF _success THEN
    UPDATE projeto_copilot_password_attempts
    SET tentativas = 0, janela_inicio = v_now, bloqueado_ate = NULL
    WHERE user_id = _user_id;
    RETURN jsonb_build_object('blocked', false, 'tentativas', 0);
  END IF;

  -- falha: incrementa
  UPDATE projeto_copilot_password_attempts
  SET tentativas = v_row.tentativas + 1,
      bloqueado_ate = CASE WHEN v_row.tentativas + 1 >= 5 THEN v_now + interval '30 minutes' ELSE NULL END
  WHERE user_id = _user_id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'blocked', v_row.bloqueado_ate IS NOT NULL,
    'bloqueado_ate', v_row.bloqueado_ate,
    'tentativas', v_row.tentativas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.register_copilot_password_attempt(uuid, boolean) FROM public, anon, authenticated;
-- só service role chama

-- RPC: ações controladas (executa com privilégios de SECURITY DEFINER, mas verifica ACL pelo _user_id)
CREATE OR REPLACE FUNCTION public.copilot_executar_acao(
  _user_id uuid,
  _projeto_id uuid,
  _tipo text,
  _payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tarefa_id uuid;
  v_secao_id uuid;
  v_responsavel uuid;
  v_prazo date;
  v_titulo text;
  v_prioridade text;
  v_status text;
  v_acesso boolean;
  v_new_id uuid;
BEGIN
  -- valida acesso ao projeto
  SELECT public.user_can_access_projeto(_user_id, _projeto_id) INTO v_acesso;
  IF NOT COALESCE(v_acesso, false) THEN
    RAISE EXCEPTION 'sem_acesso_projeto';
  END IF;

  IF _tipo = 'criar_tarefa' THEN
    v_titulo := COALESCE(_payload->>'titulo', '');
    v_secao_id := NULLIF(_payload->>'secao_id','')::uuid;
    v_responsavel := NULLIF(_payload->>'responsavel_id','')::uuid;
    v_prazo := NULLIF(_payload->>'data_prazo','')::date;
    v_prioridade := COALESCE(NULLIF(_payload->>'prioridade',''), 'media');
    IF length(v_titulo) < 1 THEN RAISE EXCEPTION 'titulo_obrigatorio'; END IF;
    IF v_secao_id IS NULL THEN
      SELECT id INTO v_secao_id FROM projeto_secoes WHERE projeto_id = _projeto_id ORDER BY ordem LIMIT 1;
      IF v_secao_id IS NULL THEN RAISE EXCEPTION 'sem_secao_no_projeto'; END IF;
    ELSE
      PERFORM 1 FROM projeto_secoes WHERE id = v_secao_id AND projeto_id = _projeto_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'secao_invalida'; END IF;
    END IF;
    INSERT INTO projeto_tarefas(projeto_id, secao_id, titulo, responsavel_id, data_prazo, prioridade, criador_id, status)
    VALUES (_projeto_id, v_secao_id, v_titulo, v_responsavel, v_prazo, v_prioridade, _user_id, 'pendente')
    RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('ok', true, 'tarefa_id', v_new_id);

  ELSIF _tipo = 'ajustar_prazo' THEN
    v_tarefa_id := (_payload->>'tarefa_id')::uuid;
    v_prazo := NULLIF(_payload->>'data_prazo','')::date;
    PERFORM 1 FROM projeto_tarefas WHERE id = v_tarefa_id AND projeto_id = _projeto_id AND excluida_em IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'tarefa_nao_encontrada'; END IF;
    UPDATE projeto_tarefas SET data_prazo = v_prazo, updated_at = now() WHERE id = v_tarefa_id;
    RETURN jsonb_build_object('ok', true, 'tarefa_id', v_tarefa_id);

  ELSIF _tipo = 'reatribuir' THEN
    v_tarefa_id := (_payload->>'tarefa_id')::uuid;
    v_responsavel := NULLIF(_payload->>'responsavel_id','')::uuid;
    PERFORM 1 FROM projeto_tarefas WHERE id = v_tarefa_id AND projeto_id = _projeto_id AND excluida_em IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'tarefa_nao_encontrada'; END IF;
    UPDATE projeto_tarefas SET responsavel_id = v_responsavel, updated_at = now() WHERE id = v_tarefa_id;
    RETURN jsonb_build_object('ok', true, 'tarefa_id', v_tarefa_id);

  ELSIF _tipo = 'mudar_status' THEN
    v_tarefa_id := (_payload->>'tarefa_id')::uuid;
    v_status := COALESCE(_payload->>'status', '');
    IF v_status NOT IN ('pendente','em_andamento','concluida','bloqueada','cancelada') THEN
      RAISE EXCEPTION 'status_invalido';
    END IF;
    PERFORM 1 FROM projeto_tarefas WHERE id = v_tarefa_id AND projeto_id = _projeto_id AND excluida_em IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'tarefa_nao_encontrada'; END IF;
    UPDATE projeto_tarefas
    SET status = v_status,
        data_conclusao = CASE WHEN v_status = 'concluida' THEN CURRENT_DATE ELSE NULL END,
        updated_at = now()
    WHERE id = v_tarefa_id;
    RETURN jsonb_build_object('ok', true, 'tarefa_id', v_tarefa_id);

  ELSIF _tipo = 'mudar_prioridade' THEN
    v_tarefa_id := (_payload->>'tarefa_id')::uuid;
    v_prioridade := COALESCE(_payload->>'prioridade', '');
    IF v_prioridade NOT IN ('baixa','media','alta') THEN RAISE EXCEPTION 'prioridade_invalida'; END IF;
    PERFORM 1 FROM projeto_tarefas WHERE id = v_tarefa_id AND projeto_id = _projeto_id AND excluida_em IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'tarefa_nao_encontrada'; END IF;
    UPDATE projeto_tarefas SET prioridade = v_prioridade, updated_at = now() WHERE id = v_tarefa_id;
    RETURN jsonb_build_object('ok', true, 'tarefa_id', v_tarefa_id);

  ELSE
    RAISE EXCEPTION 'tipo_acao_invalido: %', _tipo;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.copilot_executar_acao(uuid, uuid, text, jsonb) FROM public, anon, authenticated;