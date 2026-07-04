
-- 1.1 rpc_suporte_bulk_update: delegar às funções canônicas
CREATE OR REPLACE FUNCTION public.rpc_suporte_bulk_update(p_ticket_ids uuid[], p_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_is_priv boolean;
  v_ticket record;
  v_updated int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_new_assignee uuid;
  v_new_fila uuid;
  v_new_status text;
  v_new_prioridade text;
  v_can boolean;
  v_valid_status text[] := ARRAY['novo','em_triagem','em_atendimento','aguardando_usuario','escalado','resolvido'];
  v_valid_prio text[] := ARRAY['baixa','media','alta','critica'];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_ticket_ids IS NULL OR array_length(p_ticket_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('updated', 0, 'errors', '[]'::jsonb);
  END IF;

  IF array_length(p_ticket_ids, 1) > 500 THEN
    RAISE EXCEPTION 'bulk_limit_exceeded_max_500';
  END IF;

  v_new_assignee   := NULLIF(p_patch->>'assignee_id','')::uuid;
  v_new_fila       := NULLIF(p_patch->>'fila_id','')::uuid;
  v_new_status     := NULLIF(p_patch->>'status','');
  v_new_prioridade := NULLIF(p_patch->>'prioridade','');

  IF v_new_status IS NOT NULL AND NOT (v_new_status = ANY(v_valid_status)) THEN
    RAISE EXCEPTION 'invalid_status:%', v_new_status;
  END IF;
  IF v_new_prioridade IS NOT NULL AND NOT (v_new_prioridade = ANY(v_valid_prio)) THEN
    RAISE EXCEPTION 'invalid_prioridade:%', v_new_prioridade;
  END IF;

  v_is_priv := public.has_role(v_user, 'admin') OR public.has_role(v_user, 'supervisor');

  FOR v_ticket IN
    SELECT * FROM public.suporte_tickets WHERE id = ANY(p_ticket_ids)
  LOOP
    -- Autorização básica: admin/sup, ou membro ativo da fila de ORIGEM.
    -- (Para transferência, rpc_suporte_transferir reforça a mesma regra internamente.)
    v_can := v_is_priv OR public.is_agente_fila(v_user, v_ticket.fila_id);

    IF NOT v_can THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'ticket_id', v_ticket.id,
        'motivo', 'forbidden'
      ));
      CONTINUE;
    END IF;

    -- Assignee / prioridade: UPDATE direto (não têm efeitos colaterais de SLA)
    IF v_new_assignee IS NOT NULL OR v_new_prioridade IS NOT NULL THEN
      UPDATE public.suporte_tickets
         SET assignee_id = COALESCE(v_new_assignee, assignee_id),
             prioridade  = COALESCE(v_new_prioridade, prioridade),
             ultima_interacao_em = now(),
             updated_at = now()
       WHERE id = v_ticket.id;

      -- Prioridade nova ⇒ policy nova. Recalcula SLA só se ainda não teve
      -- primeira resposta e não está resolvido.
      IF v_new_prioridade IS NOT NULL
         AND v_ticket.primeira_resposta_em IS NULL
         AND v_ticket.status <> 'resolvido' THEN
        BEGIN
          PERFORM public.suporte_recalcular_sla(v_ticket.id, now());
        EXCEPTION WHEN OTHERS THEN
          -- não interrompe o lote
          NULL;
        END;
      END IF;
    END IF;

    -- Status via máquina canônica (respeita SLA pausado/retomado, resolved_at, etc.)
    IF v_new_status IS NOT NULL AND v_new_status <> v_ticket.status THEN
      BEGIN
        PERFORM public.suporte_aplicar_status(v_ticket.id, v_new_status, v_user);
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'ticket_id', v_ticket.id,
          'motivo', 'status_erro:' || SQLERRM
        ));
        CONTINUE;
      END;
    END IF;

    -- Transferência via RPC canônica (permissão pela fila ORIGEM, reset SLA,
    -- participantes da fila destino, mensagem, notificação ao solicitante).
    IF v_new_fila IS NOT NULL AND v_new_fila <> v_ticket.fila_id THEN
      BEGIN
        PERFORM public.rpc_suporte_transferir(v_ticket.id, v_new_fila, 'Transferência em lote', false);
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'ticket_id', v_ticket.id,
          'motivo', 'transferencia_erro:' || SQLERRM
        ));
        CONTINUE;
      END;
    END IF;

    v_updated := v_updated + 1;

    INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
    VALUES (v_ticket.id, 'bulk_update', jsonb_build_object(
      'by', v_user,
      'patch', p_patch,
      'antes', jsonb_build_object(
        'assignee_id', v_ticket.assignee_id,
        'fila_id',     v_ticket.fila_id,
        'status',      v_ticket.status,
        'prioridade',  v_ticket.prioridade
      )
    ));
  END LOOP;

  RETURN jsonb_build_object('updated', v_updated, 'errors', v_errors);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_bulk_update(uuid[], jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_bulk_update(uuid[], jsonb) TO authenticated;

-- 1.2 suporte_views: fechar WITH CHECK da policy de escrita
DROP POLICY IF EXISTS "Owner gerencia próprias views" ON public.suporte_views;
CREATE POLICY "Owner gerencia próprias views" ON public.suporte_views
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      escopo <> 'fila'
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.is_agente_fila(auth.uid(), fila_id)
    )
  );

-- 1.3 rpc_suporte_fila_membro v2: preserva papel de ativo + sync papel no projeto
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_membro(p_fila_id uuid, p_user_id uuid, p_acao text, p_papel text DEFAULT 'agente'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := auth.uid();
  v_is_admin  boolean;
  v_is_lider  boolean;
  v_alvo      record;
  v_lideres   int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_acao NOT IN ('adicionar','remover','papel') THEN RAISE EXCEPTION 'acao invalida'; END IF;
  IF p_papel NOT IN ('agente','lider') THEN RAISE EXCEPTION 'papel invalido'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.suporte_filas WHERE id = p_fila_id AND ativo) THEN
    RAISE EXCEPTION 'fila invalida';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND status = 'ativo') THEN
    RAISE EXCEPTION 'usuario invalido ou inativo';
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  v_is_lider := EXISTS (SELECT 1 FROM public.suporte_fila_agentes
                        WHERE fila_id = p_fila_id AND user_id = v_uid AND ativo AND papel = 'lider');
  IF NOT (v_is_admin OR v_is_lider) THEN
    RAISE EXCEPTION 'sem permissao para gerenciar membros desta fila';
  END IF;

  SELECT * INTO v_alvo FROM public.suporte_fila_agentes
   WHERE fila_id = p_fila_id AND user_id = p_user_id;

  IF NOT v_is_admin THEN
    IF p_papel = 'lider' OR (v_alvo.papel = 'lider' AND coalesce(v_alvo.ativo, false)) THEN
      RAISE EXCEPTION 'apenas admin gerencia lideres';
    END IF;
  END IF;

  IF p_acao = 'adicionar' THEN
    -- Se já está ATIVO, preserva o papel (mudar papel é só via p_acao='papel'
    -- — bloqueia rebaixamento do último líder por fora do guard).
    INSERT INTO public.suporte_fila_agentes (fila_id, user_id, papel, ativo)
    VALUES (p_fila_id, p_user_id, p_papel, true)
    ON CONFLICT (fila_id, user_id) DO UPDATE
      SET ativo = true,
          papel = CASE WHEN suporte_fila_agentes.ativo
                       THEN suporte_fila_agentes.papel
                       ELSE EXCLUDED.papel END;

    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT t.conversa_id, p_user_id, 'membro'
    FROM public.suporte_tickets t
    JOIN public.conversas c ON c.id = t.conversa_id AND c.tipo = 'suporte'
    WHERE t.fila_id = p_fila_id AND t.status <> 'resolvido'
    ON CONFLICT (conversa_id, usuario_id) DO UPDATE SET saiu_em = NULL;

    -- Sincronizar papel no projeto vinculado: promover, nunca rebaixar coordenador.
    INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
    SELECT f.projeto_id, p_user_id,
           CASE WHEN p_papel = 'lider' THEN 'coordenador' ELSE 'membro' END
    FROM public.suporte_filas f
    WHERE f.id = p_fila_id AND f.projeto_id IS NOT NULL
    ON CONFLICT (projeto_id, user_id) DO UPDATE
      SET papel = CASE WHEN projeto_membros.papel = 'coordenador'
                       THEN 'coordenador' ELSE EXCLUDED.papel END;

    RETURN jsonb_build_object('ok', true, 'acao', 'adicionar', 'papel', p_papel);
  END IF;

  IF v_alvo IS NULL OR NOT v_alvo.ativo THEN
    RAISE EXCEPTION 'membro nao encontrado nesta fila';
  END IF;

  IF p_acao = 'papel' THEN
    IF v_alvo.papel = 'lider' AND p_papel = 'agente' THEN
      SELECT count(*) INTO v_lideres FROM public.suporte_fila_agentes
       WHERE fila_id = p_fila_id AND ativo AND papel = 'lider';
      IF v_lideres <= 1 THEN RAISE EXCEPTION 'promova outro lider antes de rebaixar o ultimo'; END IF;
    END IF;
    UPDATE public.suporte_fila_agentes SET papel = p_papel
     WHERE fila_id = p_fila_id AND user_id = p_user_id;

    -- Sincroniza no projeto: promoção a lider ⇒ coordenador; rebaixamento
    -- não mexe (coordenador segue coordenador; ajuste manual no projeto).
    IF p_papel = 'lider' THEN
      INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
      SELECT f.projeto_id, p_user_id, 'coordenador'
      FROM public.suporte_filas f
      WHERE f.id = p_fila_id AND f.projeto_id IS NOT NULL
      ON CONFLICT (projeto_id, user_id) DO UPDATE
        SET papel = 'coordenador';
    END IF;

    RETURN jsonb_build_object('ok', true, 'acao', 'papel', 'papel', p_papel);
  END IF;

  -- remover
  IF v_alvo.papel = 'lider' THEN
    SELECT count(*) INTO v_lideres FROM public.suporte_fila_agentes
     WHERE fila_id = p_fila_id AND ativo AND papel = 'lider';
    IF v_lideres <= 1 THEN RAISE EXCEPTION 'promova outro lider antes de remover o ultimo'; END IF;
  END IF;

  UPDATE public.suporte_fila_agentes SET ativo = false
   WHERE fila_id = p_fila_id AND user_id = p_user_id;

  WITH devolvidos AS (
    UPDATE public.suporte_tickets t
       SET assignee_id = NULL, ultima_interacao_em = now()
     WHERE t.fila_id = p_fila_id AND t.assignee_id = p_user_id AND t.status <> 'resolvido'
     RETURNING t.id
  )
  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  SELECT id, 'membro_removido', jsonb_build_object('user_id', p_user_id, 'por', v_uid)
  FROM devolvidos;

  UPDATE public.conversas_participantes cp
     SET saiu_em = now()
    FROM public.suporte_tickets t
   WHERE t.conversa_id = cp.conversa_id
     AND t.fila_id = p_fila_id
     AND t.status <> 'resolvido'
     AND cp.usuario_id = p_user_id
     AND COALESCE(t.requester_id, t.owner_id) <> p_user_id;

  RETURN jsonb_build_object('ok', true, 'acao', 'remover');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_membro(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_membro(uuid, uuid, text, text) TO authenticated;

-- 1.4 suporte_on_tarefa_secao: action_url para /dashboard/suporte (Meus Chamados)
CREATE OR REPLACE FUNCTION public.suporte_on_tarefa_secao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bot   uuid := '1ee5b9de-4864-475f-9602-ee039197e46e';
  v_t     record;
  v_cfg   record;
  v_etapa text;
  v_fila  text;
  v_msg   text;
BEGIN
  SELECT t.id, t.conversa_id, t.fila_id, t.protocolo, t.titulo,
         COALESCE(t.requester_id, t.owner_id) AS requester_id, t.status
    INTO v_t
  FROM public.suporte_tickets t
  WHERE t.projeto_tarefa_id = NEW.id
  LIMIT 1;

  IF v_t.id IS NULL THEN RETURN NEW; END IF;

  SELECT nome INTO v_etapa FROM public.projeto_secoes WHERE id = NEW.secao_id;
  SELECT nome INTO v_fila  FROM public.suporte_filas  WHERE id = v_t.fila_id;

  SELECT * INTO v_cfg FROM public.suporte_etapa_mensagens
   WHERE fila_id = v_t.fila_id AND secao_id = NEW.secao_id AND ativo;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (v_t.id, 'etapa_kanban', jsonb_build_object('secao_id', NEW.secao_id, 'etapa', v_etapa));

  IF v_cfg.id IS NULL THEN RETURN NEW; END IF;

  IF coalesce(trim(v_cfg.mensagem),'') <> '' THEN
    v_msg := v_cfg.mensagem;
    v_msg := replace(v_msg, '{protocolo}',    coalesce(v_t.protocolo,''));
    v_msg := replace(v_msg, '{titulo}',       coalesce(v_t.titulo,''));
    v_msg := replace(v_msg, '{etapa}',        coalesce(v_etapa,''));
    v_msg := replace(v_msg, '{departamento}', coalesce(v_fila,''));

    INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, ticket_id, ticket_owner_id, visibilidade, metadata)
    VALUES (v_t.conversa_id, v_bot, v_msg, 'sistema', v_t.id, v_t.requester_id, 'broadcast',
            jsonb_build_object('etapa_kanban', v_etapa, 'secao_id', NEW.secao_id));
  END IF;

  IF v_cfg.notificar AND v_t.requester_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_t.requester_id, 'suporte_etapa',
            'Atualização do chamado ' || coalesce(v_t.protocolo,''),
            coalesce(v_t.titulo,'') || ' — etapa: ' || coalesce(v_etapa,''),
            '/dashboard/suporte');
  END IF;

  IF v_cfg.status_map IS NOT NULL AND v_cfg.status_map <> v_t.status THEN
    PERFORM public.suporte_aplicar_status(v_t.id, v_cfg.status_map, NULL);
  END IF;

  RETURN NEW;
END;
$function$;

-- 1.5 Reafirmar ACL de rpc_suporte_abrir_chamado
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid, text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_abrir_chamado(uuid, text, text, text) TO authenticated;
