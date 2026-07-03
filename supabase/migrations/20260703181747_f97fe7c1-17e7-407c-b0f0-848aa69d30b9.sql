
ALTER TABLE public.suporte_tickets
  ADD COLUMN IF NOT EXISTS sla_pausado_em timestamptz;
CREATE INDEX IF NOT EXISTS idx_suporte_tickets_conversa
  ON public.suporte_tickets(conversa_id);

CREATE OR REPLACE FUNCTION public.suporte_add_horas_comerciais(
  p_inicio        timestamptz,
  p_horas         numeric,
  p_calendario_id uuid DEFAULT NULL
) RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cal      record;
  v_tz       text;
  v_rest_min numeric;
  v_dia      date;
  v_cursor   timestamptz;
  v_iter     int := 0;
  v_int      record;
  v_ini_int  timestamptz;
  v_fim_int  timestamptz;
BEGIN
  IF p_inicio IS NULL OR p_horas IS NULL OR p_horas <= 0 THEN RETURN p_inicio; END IF;
  SELECT * INTO v_cal FROM public.suporte_calendarios
  WHERE id = COALESCE(p_calendario_id,
        (SELECT id FROM public.suporte_calendarios WHERE is_default AND ativo LIMIT 1))
  LIMIT 1;
  IF v_cal IS NULL THEN
    RETURN p_inicio + make_interval(secs => p_horas * 3600);
  END IF;
  v_tz       := COALESCE(v_cal.timezone, 'America/Sao_Paulo');
  v_rest_min := p_horas * 60;
  v_cursor   := p_inicio;
  v_dia      := (p_inicio AT TIME ZONE v_tz)::date;
  WHILE v_rest_min > 0 AND v_iter < 400 LOOP
    v_iter := v_iter + 1;
    IF NOT (v_dia = ANY (v_cal.feriados)) THEN
      FOR v_int IN
        SELECT (e->>'inicio')::time AS ini, (e->>'fim')::time AS fim
        FROM jsonb_array_elements(v_cal.intervalos) e
        WHERE (e->>'dow')::int = EXTRACT(dow FROM v_dia)::int
        ORDER BY (e->>'inicio')::time
      LOOP
        v_ini_int := (v_dia + v_int.ini) AT TIME ZONE v_tz;
        v_fim_int := (v_dia + v_int.fim) AT TIME ZONE v_tz;
        IF v_fim_int <= v_cursor THEN CONTINUE; END IF;
        IF v_ini_int > v_cursor THEN v_cursor := v_ini_int; END IF;
        IF v_cursor + make_interval(secs => v_rest_min * 60) <= v_fim_int THEN
          RETURN v_cursor + make_interval(secs => v_rest_min * 60);
        END IF;
        v_rest_min := v_rest_min - EXTRACT(epoch FROM (v_fim_int - v_cursor)) / 60;
        v_cursor   := v_fim_int;
      END LOOP;
    END IF;
    v_dia := v_dia + 1;
  END LOOP;
  RETURN v_cursor;
END;
$$;

CREATE OR REPLACE FUNCTION public.suporte_horas_comerciais_entre(
  p_de            timestamptz,
  p_ate           timestamptz,
  p_calendario_id uuid DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cal       record;
  v_tz        text;
  v_total_min numeric := 0;
  v_dia       date;
  v_fim_dia   date;
  v_iter      int := 0;
  v_int       record;
  v_seg_ini   timestamptz;
  v_seg_fim   timestamptz;
BEGIN
  IF p_de IS NULL OR p_ate IS NULL OR p_ate <= p_de THEN RETURN 0; END IF;
  SELECT * INTO v_cal FROM public.suporte_calendarios
  WHERE id = COALESCE(p_calendario_id,
        (SELECT id FROM public.suporte_calendarios WHERE is_default AND ativo LIMIT 1))
  LIMIT 1;
  IF v_cal IS NULL THEN
    RETURN round(EXTRACT(epoch FROM (p_ate - p_de)) / 3600, 2);
  END IF;
  v_tz      := COALESCE(v_cal.timezone, 'America/Sao_Paulo');
  v_dia     := (p_de  AT TIME ZONE v_tz)::date;
  v_fim_dia := (p_ate AT TIME ZONE v_tz)::date;
  WHILE v_dia <= v_fim_dia AND v_iter < 400 LOOP
    v_iter := v_iter + 1;
    IF NOT (v_dia = ANY (v_cal.feriados)) THEN
      FOR v_int IN
        SELECT (e->>'inicio')::time AS ini, (e->>'fim')::time AS fim
        FROM jsonb_array_elements(v_cal.intervalos) e
        WHERE (e->>'dow')::int = EXTRACT(dow FROM v_dia)::int
      LOOP
        v_seg_ini := GREATEST((v_dia + v_int.ini) AT TIME ZONE v_tz, p_de);
        v_seg_fim := LEAST((v_dia + v_int.fim) AT TIME ZONE v_tz, p_ate);
        IF v_seg_fim > v_seg_ini THEN
          v_total_min := v_total_min + EXTRACT(epoch FROM (v_seg_fim - v_seg_ini)) / 60;
        END IF;
      END LOOP;
    END IF;
    v_dia := v_dia + 1;
  END LOOP;
  RETURN round(v_total_min / 60, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.suporte_resolver_sla(
  p_fila_id    uuid,
  p_prioridade text,
  OUT fr_horas      int,
  OUT res_horas     int,
  OUT usa_hc        boolean,
  OUT calendario_id uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT sp.primeira_resposta_horas, sp.resolucao_horas, sp.usa_horario_comercial,
         COALESCE(f.calendario_id, (SELECT id FROM public.suporte_calendarios WHERE is_default AND ativo LIMIT 1))
    INTO fr_horas, res_horas, usa_hc, calendario_id
  FROM public.suporte_filas f
  LEFT JOIN public.suporte_sla_policies sp
         ON sp.fila_id = f.id AND sp.prioridade = p_prioridade
  WHERE f.id = p_fila_id;
  IF fr_horas IS NULL THEN
    SELECT f.sla_primeira_resposta_horas, f.sla_resolucao_horas, true
      INTO fr_horas, res_horas, usa_hc
    FROM public.suporte_filas f WHERE f.id = p_fila_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.suporte_recalcular_sla(
  p_ticket_id uuid,
  p_base      timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fila uuid; v_prio text; v_status text;
  s record; v_fr timestamptz; v_res timestamptz;
BEGIN
  SELECT fila_id, prioridade, status INTO v_fila, v_prio, v_status
  FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF v_fila IS NULL THEN RETURN; END IF;
  SELECT * INTO s FROM public.suporte_resolver_sla(v_fila, v_prio);
  IF s.fr_horas IS NULL THEN RETURN; END IF;
  IF COALESCE(s.usa_hc, true) THEN
    v_fr  := public.suporte_add_horas_comerciais(p_base, s.fr_horas,  s.calendario_id);
    v_res := public.suporte_add_horas_comerciais(p_base, s.res_horas, s.calendario_id);
  ELSE
    v_fr  := p_base + make_interval(hours => s.fr_horas);
    v_res := p_base + make_interval(hours => s.res_horas);
  END IF;
  UPDATE public.suporte_tickets SET
    prazo_primeira_resposta_em = CASE WHEN primeira_resposta_em IS NULL THEN v_fr ELSE prazo_primeira_resposta_em END,
    prazo_resolucao_em         = v_res,
    sla_status = CASE WHEN status = 'resolvido' THEN sla_status
                      WHEN sla_pausado_em IS NOT NULL THEN 'pausado'
                      ELSE 'dentro' END
  WHERE id = p_ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.suporte_retomar_sla(p_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v record; v_cal uuid; v_pausa_horas numeric; v_novo_res timestamptz;
BEGIN
  SELECT t.sla_pausado_em, t.prazo_primeira_resposta_em, t.prazo_resolucao_em,
         t.primeira_resposta_em, f.calendario_id
    INTO v
  FROM public.suporte_tickets t
  JOIN public.suporte_filas f ON f.id = t.fila_id
  WHERE t.id = p_ticket_id;
  IF v.sla_pausado_em IS NULL THEN RETURN; END IF;
  v_cal := COALESCE(v.calendario_id,
           (SELECT id FROM public.suporte_calendarios WHERE is_default AND ativo LIMIT 1));
  v_pausa_horas := public.suporte_horas_comerciais_entre(v.sla_pausado_em, now(), v_cal);
  v_novo_res := CASE WHEN v.prazo_resolucao_em IS NOT NULL
                     THEN public.suporte_add_horas_comerciais(v.prazo_resolucao_em, v_pausa_horas, v_cal)
                     ELSE NULL END;
  UPDATE public.suporte_tickets SET
    prazo_primeira_resposta_em = CASE WHEN primeira_resposta_em IS NULL AND prazo_primeira_resposta_em IS NOT NULL
                                      THEN public.suporte_add_horas_comerciais(prazo_primeira_resposta_em, v_pausa_horas, v_cal)
                                      ELSE prazo_primeira_resposta_em END,
    prazo_resolucao_em = COALESCE(v_novo_res, prazo_resolucao_em),
    sla_pausado_em     = NULL,
    sla_status         = CASE WHEN v_novo_res IS NOT NULL AND v_novo_res < now() THEN 'violado' ELSE 'dentro' END
  WHERE id = p_ticket_id;
END;
$$;

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

  PERFORM public.suporte_recalcular_sla(v_ticket_id, now());

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

  IF v_status_at = 'aguardando_usuario' AND p_status <> 'aguardando_usuario' THEN
    PERFORM public.suporte_retomar_sla(p_ticket_id);
  END IF;

  UPDATE public.suporte_tickets
     SET status = p_status,
         resolved_at = CASE WHEN p_status = 'resolvido' THEN now() ELSE resolved_at END,
         reaberto_em = CASE WHEN v_status_at = 'resolvido' AND p_status <> 'resolvido' THEN now() ELSE reaberto_em END,
         escalado_em = CASE WHEN p_status = 'escalado' THEN now() ELSE escalado_em END,
         ultima_interacao_em = now()
   WHERE id = p_ticket_id;

  IF p_status = 'aguardando_usuario' AND v_status_at <> 'aguardando_usuario' THEN
    UPDATE public.suporte_tickets
       SET sla_status = 'pausado', sla_pausado_em = now()
     WHERE id = p_ticket_id;
  ELSIF p_status = 'resolvido' THEN
    UPDATE public.suporte_tickets
       SET sla_status = CASE WHEN prazo_resolucao_em IS NULL OR now() <= prazo_resolucao_em
                             THEN 'cumprido' ELSE 'violado' END
     WHERE id = p_ticket_id;
  ELSIF v_status_at = 'resolvido' THEN
    UPDATE public.suporte_tickets SET sla_status = 'dentro' WHERE id = p_ticket_id;
  END IF;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (p_ticket_id, 'mudar_status', jsonb_build_object('de', v_status_at, 'para', p_status));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_mudar_status(uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_mudar_status(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.suporte_on_mensagem()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_t record;
BEGIN
  IF NEW.tipo = 'sistema' THEN RETURN NEW; END IF;
  SELECT t.id, t.fila_id, COALESCE(t.requester_id, t.owner_id) AS requester_id,
         t.status, t.primeira_resposta_em
    INTO v_t
  FROM public.suporte_tickets t
  JOIN public.conversas c ON c.id = NEW.conversa_id AND c.tipo = 'suporte'
  WHERE t.conversa_id = NEW.conversa_id
    AND t.status <> 'resolvido'
  ORDER BY t.created_at DESC
  LIMIT 1;
  IF v_t.id IS NULL THEN RETURN NEW; END IF;

  UPDATE public.suporte_tickets SET ultima_interacao_em = now() WHERE id = v_t.id;

  IF NEW.remetente_id <> v_t.requester_id
     AND (public.is_agente_fila(NEW.remetente_id, v_t.fila_id) OR public.is_suporte_staff(NEW.remetente_id)) THEN
    IF v_t.primeira_resposta_em IS NULL THEN
      UPDATE public.suporte_tickets
         SET primeira_resposta_em = NEW.created_at
       WHERE id = v_t.id AND primeira_resposta_em IS NULL;
    END IF;
  ELSIF NEW.remetente_id = v_t.requester_id AND v_t.status = 'aguardando_usuario' THEN
    PERFORM public.suporte_retomar_sla(v_t.id);
    UPDATE public.suporte_tickets SET status = 'em_atendimento' WHERE id = v_t.id;
    INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
    VALUES (v_t.id, 'retomada_usuario', jsonb_build_object('mensagem_id', NEW.id));
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_suporte_on_mensagem ON public.mensagens;
CREATE TRIGGER trg_suporte_on_mensagem
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.suporte_on_mensagem();

CREATE OR REPLACE FUNCTION public.suporte_sla_monitor()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_violados int := 0;
  v_risco    int := 0;
  r record;
  v_alvos uuid[];
  v_msg   text;
BEGIN
  FOR r IN
    SELECT t.id, t.protocolo, t.titulo, t.fila_id, t.assignee_id, f.nome AS fila_nome
    FROM public.suporte_tickets t
    JOIN public.suporte_filas f ON f.id = t.fila_id
    WHERE t.status NOT IN ('resolvido','aguardando_usuario')
      AND t.sla_status <> 'violado'
      AND (
        (t.primeira_resposta_em IS NULL AND t.prazo_primeira_resposta_em IS NOT NULL AND t.prazo_primeira_resposta_em < now())
        OR (t.prazo_resolucao_em IS NOT NULL AND t.prazo_resolucao_em < now())
      )
  LOOP
    UPDATE public.suporte_tickets SET sla_status = 'violado' WHERE id = r.id;
    v_violados := v_violados + 1;
    INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
    VALUES (r.id, 'sla_violado', jsonb_build_object('em', now()));
    v_alvos := CASE WHEN r.assignee_id IS NOT NULL THEN ARRAY[r.assignee_id]
               ELSE ARRAY(SELECT fa.user_id FROM public.suporte_fila_agentes fa
                          WHERE fa.fila_id = r.fila_id AND fa.ativo AND fa.papel = 'lider') END;
    v_msg := 'SLA violado: ' || coalesce(r.protocolo,'') || ' — ' || coalesce(r.titulo,'(sem título)') || ' (' || r.fila_nome || ')';
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    SELECT u, 'suporte_sla_violado', 'SLA violado', v_msg, '/dashboard/suporte/desk'
    FROM unnest(v_alvos) u;
  END LOOP;

  FOR r IN
    SELECT t.id, t.protocolo, t.titulo, t.fila_id, t.assignee_id, f.nome AS fila_nome,
           CASE WHEN t.primeira_resposta_em IS NULL THEN t.prazo_primeira_resposta_em ELSE t.prazo_resolucao_em END AS prazo_alvo,
           CASE WHEN t.primeira_resposta_em IS NULL THEN s.fr_horas ELSE s.res_horas END AS meta_horas,
           COALESCE(f.calendario_id, (SELECT id FROM public.suporte_calendarios WHERE is_default AND ativo LIMIT 1)) AS cal
    FROM public.suporte_tickets t
    JOIN public.suporte_filas f ON f.id = t.fila_id
    CROSS JOIN LATERAL public.suporte_resolver_sla(t.fila_id, t.prioridade) s
    WHERE t.status NOT IN ('resolvido','aguardando_usuario')
      AND t.sla_status = 'dentro'
  LOOP
    CONTINUE WHEN r.prazo_alvo IS NULL OR r.meta_horas IS NULL OR r.prazo_alvo < now();
    IF public.suporte_horas_comerciais_entre(now(), r.prazo_alvo, r.cal) < 0.2 * r.meta_horas THEN
      UPDATE public.suporte_tickets SET sla_status = 'em_risco' WHERE id = r.id;
      v_risco := v_risco + 1;
      INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
      VALUES (r.id, 'sla_em_risco', jsonb_build_object('em', now(), 'prazo', r.prazo_alvo));
      v_alvos := CASE WHEN r.assignee_id IS NOT NULL THEN ARRAY[r.assignee_id]
                 ELSE ARRAY(SELECT fa.user_id FROM public.suporte_fila_agentes fa
                            WHERE fa.fila_id = r.fila_id AND fa.ativo AND fa.papel = 'lider') END;
      v_msg := 'SLA em risco: ' || coalesce(r.protocolo,'') || ' — ' || coalesce(r.titulo,'(sem título)') || ' (' || r.fila_nome || ')';
      INSERT INTO public.notifications (user_id, type, title, message, action_url)
      SELECT u, 'suporte_sla_risco', 'SLA em risco', v_msg, '/dashboard/suporte/desk'
      FROM unnest(v_alvos) u;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('violados', v_violados, 'em_risco', v_risco);
END;
$$;

REVOKE ALL ON FUNCTION public.suporte_add_horas_comerciais(timestamptz,numeric,uuid)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suporte_horas_comerciais_entre(timestamptz,timestamptz,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suporte_resolver_sla(uuid,text)                            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suporte_recalcular_sla(uuid,timestamptz)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suporte_retomar_sla(uuid)                                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suporte_sla_monitor()                                      FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'suporte-sla-monitor') THEN
      PERFORM cron.unschedule('suporte-sla-monitor');
    END IF;
    PERFORM cron.schedule('suporte-sla-monitor', '*/5 * * * *', 'SELECT public.suporte_sla_monitor()');
  ELSE
    RAISE NOTICE 'pg_cron indisponivel — agendar public.suporte_sla_monitor() a cada 5 min por outro mecanismo';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'agendamento pg_cron falhou (%) — agendar public.suporte_sla_monitor() externamente', SQLERRM;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT t.id, t.created_at
    FROM public.suporte_tickets t
    JOIN public.conversas c ON c.id = t.conversa_id AND c.tipo = 'suporte'
    WHERE t.status <> 'resolvido' AND t.prazo_resolucao_em IS NULL AND t.fila_id IS NOT NULL
  LOOP
    PERFORM public.suporte_recalcular_sla(r.id, r.created_at);
  END LOOP;
END $$;
