
CREATE OR REPLACE FUNCTION public.rpc_suporte_transferir(
  p_ticket_id uuid,
  p_fila_destino_id uuid,
  p_motivo text,
  p_via_ia boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ticket record;
  v_fila_destino record;
  v_fila_origem record;
  v_is_admin boolean;
  v_is_staff_origem boolean;
  v_authorized boolean := false;
  v_msg_conteudo text;
  v_agente_nome text;
  v_agente_id uuid;
BEGIN
  IF v_caller IS NULL AND NOT p_via_ia THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Motivo obrigatório (mínimo 10 caracteres)' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ticket FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF v_ticket IS NULL THEN
    RAISE EXCEPTION 'Chamado não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_ticket.status = 'resolvido' THEN
    RAISE EXCEPTION 'Chamado já resolvido não pode ser transferido' USING ERRCODE = '22023';
  END IF;

  IF v_ticket.fila_id = p_fila_destino_id THEN
    RAISE EXCEPTION 'Departamento destino é o mesmo do atual' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_fila_destino FROM public.suporte_filas WHERE id = p_fila_destino_id;
  IF v_fila_destino IS NULL OR NOT v_fila_destino.ativo OR NOT v_fila_destino.aceita_chamados THEN
    RAISE EXCEPTION 'Departamento destino indisponível' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_fila_origem FROM public.suporte_filas WHERE id = v_ticket.fila_id;

  -- Autorização
  IF p_via_ia THEN
    -- Chamada da IA: só quem tem service_role/role admin pode disparar via_ia=true
    SELECT public.has_role(v_caller, 'admin') INTO v_is_admin;
    IF v_caller IS NOT NULL AND NOT v_is_admin THEN
      RAISE EXCEPTION 'via_ia reservado para automações' USING ERRCODE = '42501';
    END IF;
    v_authorized := true;
  ELSE
    SELECT public.has_role(v_caller, 'admin') INTO v_is_admin;
    IF v_is_admin THEN
      v_authorized := true;
    ELSIF v_ticket.assignee_id = v_caller THEN
      v_authorized := true;
    ELSE
      SELECT EXISTS(
        SELECT 1 FROM public.suporte_fila_agentes
        WHERE fila_id = v_ticket.fila_id AND user_id = v_caller AND ativo
      ) INTO v_is_staff_origem;
      IF v_is_staff_origem THEN v_authorized := true; END IF;
    END IF;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Sem permissão para transferir este chamado' USING ERRCODE = '42501';
  END IF;

  -- Atualiza ticket: fila destino, sem assignee, status novo, ultima_interacao=now
  UPDATE public.suporte_tickets
     SET fila_id = p_fila_destino_id,
         assignee_id = NULL,
         status = 'novo',
         ultima_interacao_em = now(),
         updated_at = now()
   WHERE id = p_ticket_id;

  -- Recalcula prazos pela SLA da fila destino a partir de agora
  PERFORM public.suporte_recalcular_sla(p_ticket_id, now());

  -- Registra em suporte_transferencias
  INSERT INTO public.suporte_transferencias
    (ticket_id, de_fila_id, para_fila_id, de_assignee_id, para_assignee_id,
     motivo, via_ia, transferido_por)
  VALUES
    (p_ticket_id, v_ticket.fila_id, p_fila_destino_id, v_ticket.assignee_id, NULL,
     btrim(p_motivo), p_via_ia, v_caller);

  -- Mensagem de sistema na conversa
  v_agente_id := v_caller;
  IF v_caller IS NOT NULL THEN
    SELECT nome INTO v_agente_nome FROM public.profiles WHERE id = v_caller;
  END IF;

  v_msg_conteudo := format(
    '🔁 Chamado transferido de **%s** para **%s**%s — %s',
    COALESCE(v_fila_origem.nome, 'Departamento anterior'),
    v_fila_destino.nome,
    CASE WHEN p_via_ia THEN ' (via IA)' ELSE '' END,
    btrim(p_motivo)
  );

  INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, metadata)
  VALUES (
    v_ticket.conversa_id,
    v_agente_id,
    v_msg_conteudo,
    'sistema',
    jsonb_build_object(
      'evento', 'suporte_transferencia',
      'de_fila_id', v_ticket.fila_id,
      'para_fila_id', p_fila_destino_id,
      'de_fila_nome', v_fila_origem.nome,
      'para_fila_nome', v_fila_destino.nome,
      'via_ia', p_via_ia,
      'agente_nome', v_agente_nome
    )
  );

  -- Notifica solicitante
  IF v_ticket.requester_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (
      v_ticket.requester_id,
      'suporte_transferencia',
      format('Chamado %s encaminhado para %s',
        COALESCE(v_ticket.protocolo, ''), v_fila_destino.nome),
      CASE WHEN p_via_ia
        THEN format('Nossa central identificou que seu chamado é melhor atendido por %s.', v_fila_destino.nome)
        ELSE format('Seu chamado foi encaminhado para %s. Motivo: %s', v_fila_destino.nome, btrim(p_motivo))
      END,
      '/dashboard/suporte/meus-chamados'
    );
  END IF;

  -- Notifica agentes/líderes ativos da fila destino
  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  SELECT
    fa.user_id,
    'suporte_novo_transferido',
    format('Novo chamado transferido para %s', v_fila_destino.nome),
    format('Chamado %s: %s',
      COALESCE(v_ticket.protocolo, ''),
      COALESCE(v_ticket.titulo, 'sem título')),
    '/dashboard/suporte/desk'
  FROM public.suporte_fila_agentes fa
  WHERE fa.fila_id = p_fila_destino_id
    AND fa.ativo
    AND fa.user_id IS DISTINCT FROM v_caller;

  RETURN jsonb_build_object(
    'ok', true,
    'ticket_id', p_ticket_id,
    'protocolo', v_ticket.protocolo,
    'de_fila_id', v_ticket.fila_id,
    'para_fila_id', p_fila_destino_id,
    'de_fila_nome', v_fila_origem.nome,
    'para_fila_nome', v_fila_destino.nome
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_transferir(uuid, uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_suporte_transferir(uuid, uuid, text, boolean) TO authenticated;
