
-- Sync triggers responsavel
CREATE OR REPLACE FUNCTION public.sync_tarefa_responsavel_from_tarefa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    IF OLD.responsavel_id IS NOT NULL THEN
      DELETE FROM public.projeto_tarefa_responsaveis
        WHERE tarefa_id = NEW.id AND user_id = OLD.responsavel_id AND papel = 'responsavel';
    END IF;
    IF NEW.responsavel_id IS NOT NULL THEN
      INSERT INTO public.projeto_tarefa_responsaveis (tarefa_id, user_id, papel, criado_por)
      VALUES (NEW.id, NEW.responsavel_id, 'responsavel', COALESCE(auth.uid(), NEW.responsavel_id))
      ON CONFLICT (tarefa_id, user_id) DO UPDATE SET papel = 'responsavel';
    END IF;
    SELECT id INTO v_ticket_id FROM public.suporte_tickets WHERE projeto_tarefa_id = NEW.id LIMIT 1;
    IF v_ticket_id IS NOT NULL THEN
      UPDATE public.suporte_tickets SET assignee_id = NEW.responsavel_id, updated_at = now()
       WHERE id = v_ticket_id AND assignee_id IS DISTINCT FROM NEW.responsavel_id;
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_tarefa_responsavel_from_tarefa ON public.projeto_tarefas;
CREATE TRIGGER trg_sync_tarefa_responsavel_from_tarefa
AFTER UPDATE OF responsavel_id ON public.projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.sync_tarefa_responsavel_from_tarefa();

CREATE OR REPLACE FUNCTION public.sync_tarefa_responsavel_from_nn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket_id uuid; v_new_resp uuid; v_tarefa uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;
  v_tarefa := COALESCE(NEW.tarefa_id, OLD.tarefa_id);
  IF (TG_OP = 'INSERT' AND NEW.papel = 'responsavel')
     OR (TG_OP = 'UPDATE' AND NEW.papel = 'responsavel'
        AND (OLD.papel IS DISTINCT FROM NEW.papel OR OLD.user_id IS DISTINCT FROM NEW.user_id)) THEN
    v_new_resp := NEW.user_id;
    UPDATE public.projeto_tarefas SET responsavel_id = v_new_resp, updated_at = now()
     WHERE id = v_tarefa AND responsavel_id IS DISTINCT FROM v_new_resp;
    SELECT id INTO v_ticket_id FROM public.suporte_tickets WHERE projeto_tarefa_id = v_tarefa LIMIT 1;
    IF v_ticket_id IS NOT NULL THEN
      UPDATE public.suporte_tickets SET assignee_id = v_new_resp, updated_at = now()
       WHERE id = v_ticket_id AND assignee_id IS DISTINCT FROM v_new_resp;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.papel = 'responsavel' THEN
    UPDATE public.projeto_tarefas SET responsavel_id = NULL, updated_at = now()
     WHERE id = v_tarefa AND responsavel_id = OLD.user_id;
    SELECT id INTO v_ticket_id FROM public.suporte_tickets WHERE projeto_tarefa_id = v_tarefa LIMIT 1;
    IF v_ticket_id IS NOT NULL THEN
      UPDATE public.suporte_tickets SET assignee_id = NULL, updated_at = now()
       WHERE id = v_ticket_id AND assignee_id = OLD.user_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;$$;

DROP TRIGGER IF EXISTS trg_sync_tarefa_responsavel_from_nn ON public.projeto_tarefa_responsaveis;
CREATE TRIGGER trg_sync_tarefa_responsavel_from_nn
AFTER INSERT OR UPDATE OR DELETE ON public.projeto_tarefa_responsaveis
FOR EACH ROW EXECUTE FUNCTION public.sync_tarefa_responsavel_from_nn();

CREATE OR REPLACE FUNCTION public.sync_ticket_assignee_to_tarefa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.projeto_tarefa_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    UPDATE public.projeto_tarefas SET responsavel_id = NEW.assignee_id, updated_at = now()
     WHERE id = NEW.projeto_tarefa_id AND responsavel_id IS DISTINCT FROM NEW.assignee_id;
    IF OLD.assignee_id IS NOT NULL THEN
      DELETE FROM public.projeto_tarefa_responsaveis
       WHERE tarefa_id = NEW.projeto_tarefa_id AND user_id = OLD.assignee_id AND papel = 'responsavel';
    END IF;
    IF NEW.assignee_id IS NOT NULL THEN
      INSERT INTO public.projeto_tarefa_responsaveis (tarefa_id, user_id, papel, criado_por)
      VALUES (NEW.projeto_tarefa_id, NEW.assignee_id, 'responsavel', COALESCE(auth.uid(), NEW.assignee_id))
      ON CONFLICT (tarefa_id, user_id) DO UPDATE SET papel = 'responsavel';
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_sync_ticket_assignee_to_tarefa ON public.suporte_tickets;
CREATE TRIGGER trg_sync_ticket_assignee_to_tarefa
AFTER UPDATE OF assignee_id ON public.suporte_tickets
FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_assignee_to_tarefa();

-- SLA recompute
CREATE OR REPLACE FUNCTION public.recompute_ticket_sla_status(_ticket_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.suporte_tickets%ROWTYPE; v_prazo timestamptz; v_status text;
        v_agora timestamptz := now(); v_janela interval := interval '1 hour';
BEGIN
  SELECT * INTO r FROM public.suporte_tickets WHERE id = _ticket_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF r.sla_pausado_em IS NOT NULL THEN v_status := 'pausado';
  ELSIF r.status = 'resolvido' THEN
    v_prazo := COALESCE(r.prazo_resolucao_em, r.prazo_primeira_resposta_em);
    v_status := CASE WHEN v_prazo IS NOT NULL AND r.resolved_at IS NOT NULL AND r.resolved_at > v_prazo THEN 'violado' ELSE 'cumprido' END;
  ELSE
    v_prazo := CASE WHEN r.primeira_resposta_em IS NOT NULL THEN r.prazo_resolucao_em ELSE r.prazo_primeira_resposta_em END;
    v_status := CASE WHEN v_prazo IS NULL THEN 'dentro'
                     WHEN v_agora >= v_prazo THEN 'violado'
                     WHEN v_agora >= v_prazo - v_janela THEN 'em_risco'
                     ELSE 'dentro' END;
  END IF;
  IF v_status IS DISTINCT FROM r.sla_status THEN
    UPDATE public.suporte_tickets SET sla_status = v_status, updated_at = now() WHERE id = _ticket_id;
  END IF;
  RETURN v_status;
END;$$;
REVOKE EXECUTE ON FUNCTION public.recompute_ticket_sla_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_ticket_sla_status(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_ticket_sla_recompute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prazo timestamptz; v_janela interval := interval '1 hour';
BEGIN
  IF NEW.sla_pausado_em IS NOT NULL THEN NEW.sla_status := 'pausado';
  ELSIF NEW.status = 'resolvido' THEN
    v_prazo := COALESCE(NEW.prazo_resolucao_em, NEW.prazo_primeira_resposta_em);
    NEW.sla_status := CASE WHEN v_prazo IS NOT NULL AND NEW.resolved_at IS NOT NULL AND NEW.resolved_at > v_prazo THEN 'violado' ELSE 'cumprido' END;
  ELSE
    v_prazo := CASE WHEN NEW.primeira_resposta_em IS NOT NULL THEN NEW.prazo_resolucao_em ELSE NEW.prazo_primeira_resposta_em END;
    NEW.sla_status := CASE WHEN v_prazo IS NULL THEN 'dentro'
                           WHEN now() >= v_prazo THEN 'violado'
                           WHEN now() >= v_prazo - v_janela THEN 'em_risco'
                           ELSE 'dentro' END;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_ticket_sla_recompute ON public.suporte_tickets;
CREATE TRIGGER trg_ticket_sla_recompute
BEFORE INSERT OR UPDATE OF status, sla_pausado_em, prazo_primeira_resposta_em,
                          prazo_resolucao_em, primeira_resposta_em, resolved_at
ON public.suporte_tickets FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_sla_recompute();

CREATE OR REPLACE FUNCTION public.sweep_ticket_sla_status()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int := 0; v_agora timestamptz := now(); v_janela interval := interval '1 hour';
BEGIN
  WITH cand AS (
    SELECT id, sla_status,
      CASE
        WHEN sla_pausado_em IS NOT NULL THEN 'pausado'
        WHEN status = 'resolvido' THEN
          CASE WHEN COALESCE(prazo_resolucao_em, prazo_primeira_resposta_em) IS NOT NULL
                AND resolved_at IS NOT NULL
                AND resolved_at > COALESCE(prazo_resolucao_em, prazo_primeira_resposta_em)
               THEN 'violado' ELSE 'cumprido' END
        ELSE
          CASE
            WHEN (CASE WHEN primeira_resposta_em IS NOT NULL THEN prazo_resolucao_em ELSE prazo_primeira_resposta_em END) IS NULL THEN 'dentro'
            WHEN v_agora >= (CASE WHEN primeira_resposta_em IS NOT NULL THEN prazo_resolucao_em ELSE prazo_primeira_resposta_em END) THEN 'violado'
            WHEN v_agora >= ((CASE WHEN primeira_resposta_em IS NOT NULL THEN prazo_resolucao_em ELSE prazo_primeira_resposta_em END) - v_janela) THEN 'em_risco'
            ELSE 'dentro'
          END
      END AS novo
    FROM public.suporte_tickets
    WHERE status <> 'resolvido' OR sla_status IS NULL
  )
  UPDATE public.suporte_tickets s SET sla_status = c.novo, updated_at = now()
    FROM cand c WHERE s.id = c.id AND s.sla_status IS DISTINCT FROM c.novo;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;$$;
REVOKE EXECUTE ON FUNCTION public.sweep_ticket_sla_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_ticket_sla_status() TO service_role;

-- Central: drop e recria com colunas de ticket
DROP FUNCTION IF EXISTS public.get_minhas_tarefas_central();
CREATE OR REPLACE FUNCTION public.get_minhas_tarefas_central()
RETURNS TABLE(
  id uuid, titulo text, descricao text, status text, prioridade text,
  data_inicio_planejada date, data_prazo date, data_conclusao date,
  projeto_id uuid, projeto_nome text, projeto_cor text,
  estagio text, criador_id uuid, visibilidade text,
  secao_id uuid, secao_nome text, ordem integer, parent_tarefa_id uuid,
  responsavel_id uuid, responsavel_nome text, responsavel_avatar_url text,
  codigo text, produto_id uuid,
  created_at timestamptz, updated_at timestamptz, papel text,
  ticket_id uuid, ticket_protocolo text, ticket_status text,
  ticket_sla_status text, ticket_prazo_resolucao_em timestamptz,
  ticket_fila_id uuid, ticket_fila_nome text,
  ticket_ultima_interacao_em timestamptz, ticket_prioridade text,
  ticket_conversa_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH minhas AS (
    SELECT t.*,
      CASE
        WHEN t.responsavel_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r WHERE r.tarefa_id = t.id AND r.user_id = auth.uid())
        THEN 'responsavel'
        WHEN EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = t.id AND c.user_id = auth.uid())
        THEN 'colaborador'
        WHEN EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s WHERE s.tarefa_id = t.id AND s.user_id = auth.uid())
        THEN 'seguidor'
        ELSE 'colaborador'
      END AS papel_calc,
      CASE
        WHEN t.responsavel_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r WHERE r.tarefa_id = t.id AND r.user_id = auth.uid())
        THEN 1
        WHEN EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = t.id AND c.user_id = auth.uid())
        THEN 2
        WHEN EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s WHERE s.tarefa_id = t.id AND s.user_id = auth.uid())
        THEN 3
        ELSE 4
      END AS papel_rank
    FROM public.projeto_tarefas t
    WHERE auth.uid() IS NOT NULL AND t.excluida_em IS NULL
      AND (
        t.responsavel_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_responsaveis r WHERE r.tarefa_id = t.id AND r.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_colaboradores c WHERE c.tarefa_id = t.id AND c.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.projeto_tarefa_seguidores s WHERE s.tarefa_id = t.id AND s.user_id = auth.uid())
      )
  ), dedup AS (SELECT DISTINCT ON (m.id) m.* FROM minhas m ORDER BY m.id, m.papel_rank)
  SELECT d.id, d.titulo, d.descricao, d.status, d.prioridade,
    d.data_inicio_planejada, d.data_prazo, d.data_conclusao,
    d.projeto_id, COALESCE(p.nome, 'Sem projeto'), COALESCE(p.cor, '#6366f1'),
    d.estagio, d.criador_id, d.visibilidade, d.secao_id, s.nome,
    COALESCE(d.ordem, 0), d.parent_tarefa_id, d.responsavel_id,
    pr.nome, pr.avatar_url, d.codigo, d.produto_id, d.created_at, d.updated_at, d.papel_calc,
    st.id, st.protocolo, st.status, st.sla_status, st.prazo_resolucao_em,
    st.fila_id, sf.nome, st.ultima_interacao_em, st.prioridade, st.conversa_id
  FROM dedup d
  LEFT JOIN public.projetos p ON p.id = d.projeto_id
  LEFT JOIN public.projeto_secoes s ON s.id = d.secao_id
  LEFT JOIN public.profiles pr ON pr.id = d.responsavel_id
  LEFT JOIN public.suporte_tickets st ON st.projeto_tarefa_id = d.id
  LEFT JOIN public.suporte_filas sf ON sf.id = st.fila_id
  ORDER BY d.data_prazo ASC NULLS LAST, d.created_at ASC;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_minhas_tarefas_central() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_minhas_tarefas_central() TO authenticated;

-- RPC adicionar participante da conversa (para chat abrir na Central)
CREATE OR REPLACE FUNCTION public.add_conversa_participante_if_missing(_conversa_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_has_access boolean := false;
BEGIN
  IF v_uid IS NULL OR _conversa_id IS NULL THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM public.conversas_participantes
     WHERE conversa_id = _conversa_id AND usuario_id = v_uid AND saiu_em IS NULL
  ) THEN RETURN true; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.suporte_tickets t
     WHERE t.conversa_id = _conversa_id
       AND (
            t.owner_id = v_uid OR t.requester_id = v_uid OR t.assignee_id = v_uid
         OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa WHERE fa.fila_id = t.fila_id AND fa.user_id = v_uid)
       )
  ) INTO v_has_access;
  IF NOT v_has_access THEN RETURN false; END IF;
  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel, entrou_em)
  VALUES (_conversa_id, v_uid, 'observador', now())
  ON CONFLICT (conversa_id, usuario_id)
    DO UPDATE SET saiu_em = NULL, papel = COALESCE(public.conversas_participantes.papel, 'observador');
  RETURN true;
END;$$;
REVOKE EXECUTE ON FUNCTION public.add_conversa_participante_if_missing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_conversa_participante_if_missing(uuid) TO authenticated;
