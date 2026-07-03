
-- 1. conversas.tipo aceita 'suporte' (aditivo)
ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_tipo_check;
ALTER TABLE public.conversas
  ADD CONSTRAINT conversas_tipo_check
  CHECK (tipo IN ('privada','grupo','private','group','suporte'));

-- 2. Realtime em suporte_tickets
ALTER TABLE public.suporte_tickets REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.suporte_tickets;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- 3. RLS de suporte_tickets: incluir agente da fila
DROP POLICY IF EXISTS "Owner e suporte veem tickets" ON public.suporte_tickets;
DROP POLICY IF EXISTS suporte_tickets_sel ON public.suporte_tickets;
CREATE POLICY suporte_tickets_sel ON public.suporte_tickets FOR SELECT TO authenticated
USING (
  requester_id = auth.uid()
  OR owner_id = auth.uid()
  OR public.is_suporte_staff(auth.uid())
  OR public.is_agente_fila(auth.uid(), fila_id)
);

DROP POLICY IF EXISTS "Suporte atualiza tickets" ON public.suporte_tickets;
DROP POLICY IF EXISTS suporte_tickets_upd ON public.suporte_tickets;
CREATE POLICY suporte_tickets_upd ON public.suporte_tickets FOR UPDATE TO authenticated
USING (
  public.is_suporte_staff(auth.uid())
  OR public.is_agente_fila(auth.uid(), fila_id)
);

-- 4. RPC: abrir chamado
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
  v_protocolo   text;
  v_titulo      text;
  v_prio        text := coalesce(p_prioridade,'media');
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
  VALUES (v_conversa_id, v_uid, 'membro')
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

  IF coalesce(trim(p_descricao),'') <> '' THEN
    INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, ticket_id, ticket_owner_id, visibilidade)
    VALUES (v_conversa_id, v_uid, p_descricao, 'texto', v_ticket_id, v_uid, 'broadcast');
  END IF;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (v_ticket_id, 'abertura', jsonb_build_object('fila_id', p_fila_id, 'canal','chat_interno','prioridade', v_prio));

  RETURN jsonb_build_object('ticket_id', v_ticket_id, 'conversa_id', v_conversa_id, 'protocolo', v_protocolo);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid,text,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid,text,text,text) TO authenticated;

-- 5. RPC: assumir chamado
CREATE OR REPLACE FUNCTION public.rpc_suporte_assumir(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_fila_id uuid;
  v_conv_id uuid;
  v_status  text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT fila_id, conversa_id, status INTO v_fila_id, v_conv_id, v_status
    FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket nao encontrado'; END IF;
  IF NOT (public.is_suporte_staff(v_uid) OR public.is_agente_fila(v_uid, v_fila_id)) THEN
    RAISE EXCEPTION 'sem permissao nesta fila';
  END IF;

  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  VALUES (v_conv_id, v_uid, 'membro')
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  UPDATE public.suporte_tickets
     SET assignee_id = v_uid,
         status = CASE WHEN status = 'novo' THEN 'em_atendimento' ELSE status END,
         ultima_interacao_em = now()
   WHERE id = p_ticket_id;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (p_ticket_id, 'assumir', jsonb_build_object('assignee_id', v_uid));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_assumir(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_assumir(uuid) TO authenticated;

-- 6. RPC: mudar status
CREATE OR REPLACE FUNCTION public.rpc_suporte_mudar_status(p_ticket_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_fila_id   uuid;
  v_status_at text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_status NOT IN ('novo','em_triagem','em_atendimento','aguardando_usuario','escalado','resolvido') THEN
    RAISE EXCEPTION 'status invalido';
  END IF;
  SELECT fila_id, status INTO v_fila_id, v_status_at
    FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket nao encontrado'; END IF;
  IF NOT (public.is_suporte_staff(v_uid) OR public.is_agente_fila(v_uid, v_fila_id)) THEN
    RAISE EXCEPTION 'sem permissao nesta fila';
  END IF;

  UPDATE public.suporte_tickets
     SET status = p_status,
         resolved_at = CASE WHEN p_status = 'resolvido' THEN now() ELSE resolved_at END,
         reaberto_em = CASE WHEN v_status_at = 'resolvido' AND p_status <> 'resolvido' THEN now() ELSE reaberto_em END,
         escalado_em = CASE WHEN p_status = 'escalado' THEN now() ELSE escalado_em END,
         ultima_interacao_em = now()
   WHERE id = p_ticket_id;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (p_ticket_id, 'mudar_status', jsonb_build_object('de', v_status_at, 'para', p_status));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_mudar_status(uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_mudar_status(uuid,text) TO authenticated;
