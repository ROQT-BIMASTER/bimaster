
CREATE OR REPLACE FUNCTION public.rpc_suporte_abrir_chamado(
  p_fila_id    uuid,
  p_titulo     text,
  p_descricao  text DEFAULT NULL,
  p_prioridade text DEFAULT 'media'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_conversa_id uuid;
  v_ticket_id   uuid;
  v_msg_id      uuid;
  v_protocolo   text;
  v_titulo      text;
  v_prio        text := coalesce(p_prioridade,'media');
  v_bot         uuid := '1ee5b9de-4864-475f-9602-ee039197e46e';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suporte_filas WHERE id = p_fila_id AND ativo AND aceita_chamados) THEN
    RAISE EXCEPTION 'fila invalida ou nao aceita chamados';
  END IF;
  IF v_prio NOT IN ('baixa','media','alta','critica') THEN v_prio := 'media'; END IF;
  v_titulo := trim(coalesce(p_titulo,''));
  IF v_titulo = '' THEN RAISE EXCEPTION 'titulo obrigatorio'; END IF;
  IF length(v_titulo) > 200 THEN v_titulo := substr(v_titulo,1,200); END IF;

  INSERT INTO public.conversas (nome, tipo, criado_por)
  VALUES (left('Chamado: ' || v_titulo, 120), 'suporte', v_uid)
  RETURNING id INTO v_conversa_id;

  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  VALUES (v_conversa_id, v_uid, 'membro'), (v_conversa_id, v_bot, 'membro')
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  SELECT v_conversa_id, fa.user_id, 'membro'
  FROM public.suporte_fila_agentes fa
  WHERE fa.fila_id = p_fila_id AND fa.ativo AND fa.user_id <> v_uid
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  INSERT INTO public.suporte_tickets (conversa_id, owner_id, requester_id, fila_id, canal, status, prioridade, titulo)
  VALUES (v_conversa_id, v_uid, v_uid, p_fila_id, 'chat_interno', 'novo', v_prio, v_titulo)
  RETURNING id INTO v_ticket_id;

  v_protocolo := 'RR-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(v_ticket_id::text,'-',''),1,6));
  UPDATE public.suporte_tickets SET protocolo = v_protocolo WHERE id = v_ticket_id;

  PERFORM public.suporte_recalcular_sla(v_ticket_id, now());

  IF coalesce(trim(p_descricao),'') <> '' THEN
    INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, ticket_id, ticket_owner_id, visibilidade)
    VALUES (v_conversa_id, v_uid, p_descricao, 'texto', v_ticket_id, v_uid, 'broadcast')
    RETURNING id INTO v_msg_id;
  END IF;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (v_ticket_id, 'abertura', jsonb_build_object('fila_id', p_fila_id, 'canal','chat_interno','prioridade', v_prio));

  RETURN jsonb_build_object(
    'ticket_id', v_ticket_id,
    'conversa_id', v_conversa_id,
    'protocolo', v_protocolo,
    'primeira_mensagem_id', v_msg_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid,text,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid,text,text,text) TO authenticated;
