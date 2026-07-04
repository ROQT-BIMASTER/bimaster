
-- Helper: sincroniza card do kanban com a fila atual do ticket
CREATE OR REPLACE FUNCTION public.suporte_sync_tarefa_para_fila(p_ticket_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t          record;
  v_fila       record;
  v_secao      uuid;
  v_tarefa_old uuid;
  v_tarefa_new uuid;
  v_prio_task  text;
BEGIN
  SELECT id, fila_id, projeto_tarefa_id, protocolo, titulo, prioridade, owner_id, status, descricao_sanitizada
    INTO v_t
  FROM (
    SELECT t.*, NULL::text AS descricao_sanitizada FROM public.suporte_tickets t
  ) x WHERE id = p_ticket_id;
  IF v_t.id IS NULL THEN RETURN NULL; END IF;

  SELECT id, projeto_id, auto_criar_tarefa, nome
    INTO v_fila
  FROM public.suporte_filas WHERE id = v_t.fila_id;

  v_tarefa_old := v_t.projeto_tarefa_id;

  -- Fila sem projeto vinculado (ou auto desligado): remover card antigo se existir
  IF v_fila.projeto_id IS NULL OR v_fila.auto_criar_tarefa = false THEN
    IF v_tarefa_old IS NOT NULL THEN
      DELETE FROM public.projeto_tarefas WHERE id = v_tarefa_old;
      UPDATE public.suporte_tickets SET projeto_tarefa_id = NULL WHERE id = p_ticket_id;
    END IF;
    RETURN NULL;
  END IF;

  -- Se já existe card no projeto correto, mantém
  IF v_tarefa_old IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projeto_tarefas
     WHERE id = v_tarefa_old AND projeto_id = v_fila.projeto_id
  ) THEN
    RETURN v_tarefa_old;
  END IF;

  -- Card em outro projeto ou inexistente: apagar velho, criar novo em "Em espera"
  IF v_tarefa_old IS NOT NULL THEN
    DELETE FROM public.projeto_tarefas WHERE id = v_tarefa_old;
  END IF;

  SELECT id INTO v_secao FROM public.projeto_secoes
   WHERE projeto_id = v_fila.projeto_id
   ORDER BY ordem ASC, created_at ASC LIMIT 1;
  IF v_secao IS NULL THEN
    UPDATE public.suporte_tickets SET projeto_tarefa_id = NULL WHERE id = p_ticket_id;
    RETURN NULL;
  END IF;

  v_prio_task := CASE v_t.prioridade WHEN 'critica' THEN 'urgente' ELSE v_t.prioridade END;

  INSERT INTO public.projeto_tarefas
    (projeto_id, secao_id, titulo, prioridade, criador_id, canal_criacao)
  VALUES
    (v_fila.projeto_id, v_secao,
     '[' || coalesce(v_t.protocolo,'') || '] ' || coalesce(v_t.titulo,''),
     v_prio_task, coalesce(v_t.owner_id, auth.uid()), 'suporte_fila')
  RETURNING id INTO v_tarefa_new;

  UPDATE public.suporte_tickets SET projeto_tarefa_id = v_tarefa_new WHERE id = p_ticket_id;
  RETURN v_tarefa_new;
END;
$$;

REVOKE ALL ON FUNCTION public.suporte_sync_tarefa_para_fila(uuid) FROM PUBLIC, anon, authenticated;

-- Patch: rpc_suporte_transferir chama o sync ao final
CREATE OR REPLACE FUNCTION public.rpc_suporte_transferir(p_ticket_id uuid, p_para_fila_id uuid, p_motivo text DEFAULT NULL::text, p_via_ia boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Mover / recriar card do kanban no projeto do novo departamento
  PERFORM public.suporte_sync_tarefa_para_fila(p_ticket_id);

  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  SELECT v_t.conversa_id, fa.user_id, 'membro'
  FROM public.suporte_fila_agentes fa
  WHERE fa.fila_id = v_fila_destino.id AND fa.ativo
  ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

  INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, ticket_id, ticket_owner_id, visibilidade, metadata)
  VALUES (
    v_t.conversa_id,
    COALESCE(v_uid, v_requester),
    'Chamado transferido: ' || COALESCE(v_fila_origem,'?') || ' -> ' || v_fila_destino.nome
      || COALESCE(E'\nMotivo: ' || v_motivo, ''),
    'sistema',
    p_ticket_id, v_requester, 'broadcast',
    jsonb_build_object('transferencia', true, 'de_fila', v_t.fila_id, 'para_fila', v_fila_destino.id, 'via_ia', p_via_ia)
  );

  IF v_requester IS NOT NULL AND v_requester <> COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (
      v_requester, 'suporte_transferencia', 'Chamado encaminhado',
      'Seu chamado ' || COALESCE(v_t.protocolo,'') || ' - ' || COALESCE(v_t.titulo,'') ||
      ' foi encaminhado para ' || v_fila_destino.nome || ' e voltou ao status "Novo".',
      '/dashboard/suporte'
    );
  END IF;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (p_ticket_id, 'transferencia',
          jsonb_build_object('de', v_t.fila_id, 'para', v_fila_destino.id, 'motivo', v_motivo, 'via_ia', p_via_ia));

  RETURN jsonb_build_object('ok', true, 'para_fila', v_fila_destino.nome);
END;
$function$;

-- Patch: rpc_suporte_fila_criar_projeto faz backfill dos tickets abertos ao final
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_criar_projeto(p_fila_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_fila    record;
  v_projeto uuid;
  v_secao_espera uuid; v_secao_analise uuid; v_secao_fim uuid; v_secao_rej uuid;
  v_ticket  record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_fila FROM public.suporte_filas WHERE id = p_fila_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'fila invalida'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.suporte_fila_agentes WHERE fila_id = p_fila_id AND user_id = v_uid AND ativo AND papel='lider'
  )) THEN RAISE EXCEPTION 'sem permissao'; END IF;
  IF v_fila.projeto_id IS NOT NULL THEN RAISE EXCEPTION 'fila ja tem projeto vinculado'; END IF;

  INSERT INTO public.projetos (nome, descricao, cor, icone, criador_id, status, tipo, visibilidade)
  VALUES ('Suporte - ' || v_fila.nome, 'Fluxo de chamados do departamento ' || v_fila.nome || '.',
          coalesce(v_fila.cor, '#185FA5'), 'life-buoy', v_uid, 'ativo', 'generico', 'equipe')
  RETURNING id INTO v_projeto;

  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Em espera',1)  RETURNING id INTO v_secao_espera;
  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Em analise',2) RETURNING id INTO v_secao_analise;
  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Finalizado',3) RETURNING id INTO v_secao_fim;
  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Rejeitado',4)  RETURNING id INTO v_secao_rej;

  INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
  SELECT v_projeto, fa.user_id, CASE fa.papel WHEN 'lider' THEN 'coordenador' ELSE 'membro' END
  FROM public.suporte_fila_agentes fa WHERE fa.fila_id = p_fila_id AND fa.ativo
  ON CONFLICT DO NOTHING;

  UPDATE public.suporte_filas SET projeto_id = v_projeto WHERE id = p_fila_id;

  INSERT INTO public.suporte_etapa_mensagens (fila_id, secao_id, mensagem, status_map, notificar) VALUES
    (p_fila_id, v_secao_espera,  'Seu chamado {protocolo} foi recebido pela equipe de {departamento} e esta na fila de trabalho.', 'em_triagem', true),
    (p_fila_id, v_secao_analise, 'Boa noticia: o chamado {protocolo} esta em analise - ja tem alguem trabalhando no assunto.', 'em_atendimento', true),
    (p_fila_id, v_secao_fim,     'O chamado {protocolo} - {titulo} - foi concluido pela equipe de {departamento}. Se o problema persistir, basta responder por aqui.', 'resolvido', true),
    (p_fila_id, v_secao_rej,     'O chamado {protocolo} foi analisado e nao seguira adiante. A equipe de {departamento} registrou o motivo na conversa.', 'resolvido', true)
  ON CONFLICT (fila_id, secao_id) DO NOTHING;

  -- Backfill: leva os tickets abertos para o novo kanban
  FOR v_ticket IN
    SELECT id FROM public.suporte_tickets
     WHERE fila_id = p_fila_id AND status <> 'resolvido' AND projeto_tarefa_id IS NULL
  LOOP
    PERFORM public.suporte_sync_tarefa_para_fila(v_ticket.id);
  END LOOP;

  RETURN v_projeto;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_criar_projeto(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_criar_projeto(uuid) TO authenticated;

-- Patch: rpc_suporte_fila_vincular_projeto faz backfill ao vincular
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_vincular_projeto(p_fila_id uuid, p_projeto_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ticket record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.suporte_fila_agentes WHERE fila_id = p_fila_id AND user_id = v_uid AND ativo AND papel='lider'
  )) THEN RAISE EXCEPTION 'sem permissao'; END IF;
  IF p_projeto_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.projetos WHERE id = p_projeto_id) THEN
    RAISE EXCEPTION 'projeto invalido';
  END IF;

  UPDATE public.suporte_filas SET projeto_id = p_projeto_id WHERE id = p_fila_id;

  FOR v_ticket IN
    SELECT id FROM public.suporte_tickets
     WHERE fila_id = p_fila_id AND status <> 'resolvido'
  LOOP
    PERFORM public.suporte_sync_tarefa_para_fila(v_ticket.id);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_vincular_projeto(uuid,uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_vincular_projeto(uuid,uuid) TO authenticated;

-- Backfill imediato dos tickets abertos das filas ja vinculadas
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.id FROM public.suporte_tickets t
    JOIN public.suporte_filas f ON f.id = t.fila_id
    WHERE t.status <> 'resolvido'
      AND t.projeto_tarefa_id IS NULL
      AND f.projeto_id IS NOT NULL
      AND f.auto_criar_tarefa = true
  LOOP
    PERFORM public.suporte_sync_tarefa_para_fila(r.id);
  END LOOP;
END $$;
