
DROP FUNCTION IF EXISTS public.rpc_suporte_transferir(uuid, uuid, text, boolean);

CREATE FUNCTION public.rpc_suporte_transferir(
  p_ticket_id    uuid,
  p_para_fila_id uuid,
  p_motivo       text DEFAULT NULL,
  p_via_ia       boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_t            record;
  v_fila_destino record;
  v_fila_origem  text;
  v_motivo       text := NULLIF(trim(coalesce(p_motivo,'')), '');
  v_requester    uuid;
BEGIN
  IF v_uid IS NULL AND NOT p_via_ia THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_via_ia AND v_uid IS NOT NULL THEN p_via_ia := false; END IF;

  SELECT t.id, t.fila_id, t.conversa_id, t.status, t.assignee_id, t.protocolo, t.titulo,
         COALESCE(t.requester_id, t.owner_id) AS requester_id
    INTO v_t
  FROM public.suporte_tickets t WHERE t.id = p_ticket_id;
  IF v_t.id IS NULL THEN RAISE EXCEPTION 'ticket nao encontrado'; END IF;
  IF v_t.status = 'resolvido' THEN RAISE EXCEPTION 'ticket resolvido nao pode ser transferido'; END IF;

  IF v_uid IS NOT NULL
     AND NOT (public.is_suporte_staff(v_uid) OR public.is_agente_fila(v_uid, v_t.fila_id)) THEN
    RAISE EXCEPTION 'sem permissao nesta fila';
  END IF;

  SELECT id, nome INTO v_fila_destino
  FROM public.suporte_filas
  WHERE id = p_para_fila_id AND ativo AND aceita_chamados;
  IF v_fila_destino.id IS NULL THEN RAISE EXCEPTION 'fila destino invalida ou nao aceita chamados'; END IF;
  IF v_fila_destino.id = v_t.fila_id THEN RAISE EXCEPTION 'ticket ja esta nesta fila'; END IF;

  SELECT nome INTO v_fila_origem FROM public.suporte_filas WHERE id = v_t.fila_id;
  v_requester := v_t.requester_id;

  IF v_t.status = 'aguardando_usuario' THEN
    PERFORM public.suporte_retomar_sla(p_ticket_id);
  END IF;

  INSERT INTO public.suporte_transferencias
    (ticket_id, de_fila_id, para_fila_id, de_assignee_id, para_assignee_id, motivo, via_ia, transferido_por)
  VALUES
    (p_ticket_id, v_t.fila_id, v_fila_destino.id, v_t.assignee_id, NULL, v_motivo, p_via_ia, v_uid);

  UPDATE public.suporte_tickets
     SET fila_id = v_fila_destino.id,
         assignee_id = NULL,
         status = 'novo',
         ultima_interacao_em = now()
   WHERE id = p_ticket_id;

  PERFORM public.suporte_recalcular_sla(p_ticket_id, now());

  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  SELECT v_t.conversa_id, fa.user_id, 'membro'
  FROM public.suporte_fila_agentes fa
  WHERE fa.fila_id = v_fila_destino.id AND fa.ativo
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, ticket_id, ticket_owner_id, visibilidade, metadata)
  VALUES (
    v_t.conversa_id,
    COALESCE(v_uid, v_requester),
    '🔁 Chamado transferido: ' || COALESCE(v_fila_origem,'?') || ' → ' || v_fila_destino.nome
      || COALESCE(E'\nMotivo: ' || v_motivo, ''),
    'sistema',
    p_ticket_id, v_requester, 'broadcast',
    jsonb_build_object('transferencia', true, 'de_fila', v_t.fila_id, 'para_fila', v_fila_destino.id, 'via_ia', p_via_ia)
  );

  IF v_requester IS NOT NULL AND v_requester <> COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (
      v_requester, 'suporte_transferencia', 'Chamado encaminhado',
      'Seu chamado ' || COALESCE(v_t.protocolo,'') || ' — ' || COALESCE(v_t.titulo,'') ||
      ' foi encaminhado para ' || v_fila_destino.nome || ' e voltou ao status "Novo".',
      '/dashboard/suporte'
    );
  END IF;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (p_ticket_id, 'transferencia',
          jsonb_build_object('de', v_t.fila_id, 'para', v_fila_destino.id, 'motivo', v_motivo, 'via_ia', p_via_ia));

  RETURN jsonb_build_object('ok', true, 'para_fila', v_fila_destino.nome);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_transferir(uuid,uuid,text,boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_transferir(uuid,uuid,text,boolean) TO authenticated;
