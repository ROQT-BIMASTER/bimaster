-- Suporte B6: escalonamento de chamados
-- Permite que agentes/admins elevem um chamado marcando-o como "escalado",
-- aumentando a prioridade (opcional) e registrando o motivo. Uma nota
-- interna é publicada no chat para os demais agentes, oculta do solicitante.

CREATE OR REPLACE FUNCTION public.rpc_suporte_escalonar(
  p_ticket_id uuid,
  p_motivo text,
  p_nova_prioridade text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ticket record;
  v_pode boolean;
  v_prio text;
  v_msg_id uuid;
  v_conteudo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING ERRCODE = '42501';
  END IF;

  IF coalesce(trim(p_motivo), '') = '' OR length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'motivo obrigatório (mínimo 10 caracteres)' USING ERRCODE = '22023';
  END IF;

  SELECT id, fila_id, status, prioridade, conversa_id, requester_id, owner_id
    INTO v_ticket
  FROM public.suporte_tickets
  WHERE id = p_ticket_id;

  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'chamado não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_ticket.status = 'resolvido' THEN
    RAISE EXCEPTION 'chamado resolvido não pode ser escalonado' USING ERRCODE = '22023';
  END IF;

  -- Autorização: admin, papel 'suporte' ou agente/lider da fila do chamado.
  v_pode := public.has_role(v_uid, 'admin'::app_role)
         OR public.has_role(v_uid, 'suporte'::app_role)
         OR EXISTS (
           SELECT 1 FROM public.suporte_fila_agentes
           WHERE fila_id = v_ticket.fila_id
             AND user_id = v_uid
             AND ativo = true
         );

  IF NOT v_pode THEN
    RAISE EXCEPTION 'sem permissão para escalonar este chamado' USING ERRCODE = '42501';
  END IF;

  -- Nova prioridade (se fornecida e maior que a atual)
  v_prio := coalesce(p_nova_prioridade, v_ticket.prioridade);
  IF v_prio NOT IN ('baixa','media','alta','critica') THEN
    RAISE EXCEPTION 'prioridade inválida' USING ERRCODE = '22023';
  END IF;

  UPDATE public.suporte_tickets
     SET status = 'escalado',
         prioridade = v_prio,
         escalado_em = now(),
         ultima_interacao_em = now()
   WHERE id = p_ticket_id;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (
    p_ticket_id,
    'escalonar',
    jsonb_build_object(
      'por', v_uid,
      'motivo', trim(p_motivo),
      'prioridade_anterior', v_ticket.prioridade,
      'prioridade_nova', v_prio
    )
  );

  -- Nota interna no chat do chamado (visível apenas a agentes/admin).
  v_conteudo := '⚠️ Chamado escalonado por ' ||
                coalesce((SELECT nome FROM public.profiles WHERE id = v_uid), 'agente') ||
                E'\nPrioridade: ' || v_prio ||
                E'\nMotivo: ' || trim(p_motivo);

  INSERT INTO public.mensagens (
    conversa_id, remetente_id, conteudo, tipo,
    ticket_id, ticket_owner_id, visibilidade, metadata
  )
  VALUES (
    v_ticket.conversa_id, v_uid, v_conteudo, 'texto',
    v_ticket.id,
    coalesce(v_ticket.requester_id, v_ticket.owner_id),
    'interna',
    jsonb_build_object('evento', 'escalonamento', 'prioridade', v_prio)
  )
  RETURNING id INTO v_msg_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ticket_id', p_ticket_id,
    'prioridade', v_prio,
    'mensagem_id', v_msg_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_suporte_escalonar(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_suporte_escalonar(uuid, text, text) TO authenticated;