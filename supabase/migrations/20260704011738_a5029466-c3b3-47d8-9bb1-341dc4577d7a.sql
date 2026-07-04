
-- 1) suporte_filas: projeto_id + auto_criar_tarefa
ALTER TABLE public.suporte_filas
  ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_criar_tarefa boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_suporte_tickets_tarefa
  ON public.suporte_tickets(projeto_tarefa_id) WHERE projeto_tarefa_id IS NOT NULL;

-- 2) mensagens por etapa
CREATE TABLE IF NOT EXISTS public.suporte_etapa_mensagens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fila_id    uuid NOT NULL REFERENCES public.suporte_filas(id) ON DELETE CASCADE,
  secao_id   uuid NOT NULL REFERENCES public.projeto_secoes(id) ON DELETE CASCADE,
  mensagem   text CHECK (length(coalesce(mensagem,'')) <= 1000),
  status_map text CHECK (status_map IN ('novo','em_triagem','em_atendimento','aguardando_usuario','escalado','resolvido')),
  notificar  boolean NOT NULL DEFAULT true,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fila_id, secao_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suporte_etapa_mensagens TO authenticated;
GRANT ALL ON public.suporte_etapa_mensagens TO service_role;
ALTER TABLE public.suporte_etapa_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sup_etapa_msg_sel ON public.suporte_etapa_mensagens;
CREATE POLICY sup_etapa_msg_sel ON public.suporte_etapa_mensagens
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sup_etapa_msg_write ON public.suporte_etapa_mensagens;
CREATE POLICY sup_etapa_msg_write ON public.suporte_etapa_mensagens
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa
               WHERE fa.fila_id = suporte_etapa_mensagens.fila_id
                 AND fa.user_id = auth.uid() AND fa.ativo AND fa.papel = 'lider')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa
               WHERE fa.fila_id = suporte_etapa_mensagens.fila_id
                 AND fa.user_id = auth.uid() AND fa.ativo AND fa.papel = 'lider')
  );

DROP TRIGGER IF EXISTS trg_sup_etapa_msg_updated ON public.suporte_etapa_mensagens;
CREATE TRIGGER trg_sup_etapa_msg_updated BEFORE UPDATE ON public.suporte_etapa_mensagens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) suporte_aplicar_status (efeitos de status extraídos)
CREATE OR REPLACE FUNCTION public.suporte_aplicar_status(
  p_ticket_id uuid, p_status text, p_ator uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status_at text;
BEGIN
  IF p_status NOT IN ('novo','em_triagem','em_atendimento','aguardando_usuario','escalado','resolvido') THEN
    RAISE EXCEPTION 'status invalido';
  END IF;

  SELECT status INTO v_status_at FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF NOT FOUND OR v_status_at = p_status THEN RETURN; END IF;

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
    UPDATE public.suporte_tickets SET sla_status = 'pausado', sla_pausado_em = now() WHERE id = p_ticket_id;
  ELSIF p_status = 'resolvido' THEN
    UPDATE public.suporte_tickets
       SET sla_status = CASE WHEN prazo_resolucao_em IS NULL OR now() <= prazo_resolucao_em THEN 'cumprido' ELSE 'violado' END
     WHERE id = p_ticket_id;
  ELSIF v_status_at = 'resolvido' THEN
    UPDATE public.suporte_tickets SET sla_status = 'dentro' WHERE id = p_ticket_id;
  END IF;

  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  VALUES (p_ticket_id, 'mudar_status', jsonb_build_object('de', v_status_at, 'para', p_status, 'ator', p_ator));
END;
$$;
REVOKE ALL ON FUNCTION public.suporte_aplicar_status(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.suporte_aplicar_status(uuid, text, uuid) FROM anon, authenticated;

-- 4) rpc_suporte_mudar_status delega
CREATE OR REPLACE FUNCTION public.rpc_suporte_mudar_status(p_ticket_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_fila_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT fila_id INTO v_fila_id FROM public.suporte_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket nao encontrado'; END IF;
  IF NOT (public.is_suporte_staff(v_uid) OR public.is_agente_fila(v_uid, v_fila_id)) THEN
    RAISE EXCEPTION 'sem permissao nesta fila';
  END IF;
  PERFORM public.suporte_aplicar_status(p_ticket_id, p_status, v_uid);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_mudar_status(uuid,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_mudar_status(uuid,text) TO authenticated;

-- 5) rpc_suporte_abrir_chamado — mantém corpo 3B + bloco kanban
CREATE OR REPLACE FUNCTION public.rpc_suporte_abrir_chamado(
  p_fila_id uuid, p_titulo text, p_descricao text DEFAULT NULL::text, p_prioridade text DEFAULT 'media'::text
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
  v_projeto     uuid;
  v_secao       uuid;
  v_tarefa      uuid;
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

  -- >>> Integração com kanban do departamento
  SELECT f.projeto_id INTO v_projeto FROM public.suporte_filas f
   WHERE f.id = p_fila_id AND f.auto_criar_tarefa AND f.projeto_id IS NOT NULL;
  IF v_projeto IS NOT NULL THEN
    SELECT id INTO v_secao FROM public.projeto_secoes
     WHERE projeto_id = v_projeto ORDER BY ordem ASC, created_at ASC LIMIT 1;
    IF v_secao IS NOT NULL THEN
      INSERT INTO public.projeto_tarefas (projeto_id, secao_id, titulo, descricao, prioridade, criador_id, canal_criacao)
      VALUES (v_projeto, v_secao,
              '[' || v_protocolo || '] ' || v_titulo,
              left(coalesce(p_descricao,''), 2000),
              CASE v_prio WHEN 'critica' THEN 'urgente' ELSE v_prio END,
              v_uid, 'suporte_fila')
      RETURNING id INTO v_tarefa;
      UPDATE public.suporte_tickets SET projeto_tarefa_id = v_tarefa WHERE id = v_ticket_id;
    END IF;
  END IF;

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

-- 6) Trigger: mover card → mensagem/notificação/status
CREATE OR REPLACE FUNCTION public.suporte_on_tarefa_secao()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
            '/dashboard/suporte/desk');
  END IF;

  IF v_cfg.status_map IS NOT NULL AND v_cfg.status_map <> v_t.status THEN
    PERFORM public.suporte_aplicar_status(v_t.id, v_cfg.status_map, NULL);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suporte_tarefa_secao ON public.projeto_tarefas;
CREATE TRIGGER trg_suporte_tarefa_secao
AFTER UPDATE OF secao_id ON public.projeto_tarefas
FOR EACH ROW
WHEN (OLD.secao_id IS DISTINCT FROM NEW.secao_id)
EXECUTE FUNCTION public.suporte_on_tarefa_secao();

-- 7) rpc_suporte_fila_criar
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_criar(
  p_nome text, p_slug text, p_descricao text DEFAULT NULL,
  p_cor text DEFAULT NULL, p_icone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'apenas admin cria departamentos';
  END IF;
  IF coalesce(trim(p_nome),'') = '' OR coalesce(trim(p_slug),'') = '' THEN
    RAISE EXCEPTION 'nome e slug obrigatorios';
  END IF;

  INSERT INTO public.suporte_filas (nome, slug, descricao, cor, icone, ordem, calendario_id)
  VALUES (trim(p_nome), lower(trim(p_slug)), p_descricao, p_cor, p_icone,
          (SELECT coalesce(max(ordem),0)+1 FROM public.suporte_filas),
          (SELECT id FROM public.suporte_calendarios WHERE is_default AND ativo LIMIT 1))
  RETURNING id INTO v_id;

  INSERT INTO public.suporte_sla_policies (fila_id, prioridade, primeira_resposta_horas, resolucao_horas)
  VALUES (v_id,'critica',1,4), (v_id,'alta',2,8), (v_id,'media',4,24), (v_id,'baixa',8,40)
  ON CONFLICT (fila_id, prioridade) DO NOTHING;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_criar(text,text,text,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_criar(text,text,text,text,text) TO authenticated;

-- 8) rpc_suporte_fila_criar_projeto
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_criar_projeto(p_fila_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_fila    record;
  v_projeto uuid;
  v_secao_espera uuid; v_secao_analise uuid; v_secao_fim uuid; v_secao_rej uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_fila FROM public.suporte_filas WHERE id = p_fila_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'fila invalida'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.suporte_fila_agentes WHERE fila_id = p_fila_id AND user_id = v_uid AND ativo AND papel='lider'
  )) THEN RAISE EXCEPTION 'sem permissao'; END IF;
  IF v_fila.projeto_id IS NOT NULL THEN RAISE EXCEPTION 'fila ja tem projeto vinculado'; END IF;

  INSERT INTO public.projetos (nome, descricao, cor, icone, criador_id, status, tipo, visibilidade)
  VALUES ('Suporte — ' || v_fila.nome, 'Fluxo de chamados do departamento ' || v_fila.nome || '.',
          coalesce(v_fila.cor, '#185FA5'), 'life-buoy', v_uid, 'ativo', 'generico', 'equipe')
  RETURNING id INTO v_projeto;

  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Em espera',1)  RETURNING id INTO v_secao_espera;
  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Em análise',2) RETURNING id INTO v_secao_analise;
  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Finalizado',3) RETURNING id INTO v_secao_fim;
  INSERT INTO public.projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto,'Rejeitado',4)  RETURNING id INTO v_secao_rej;

  INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
  SELECT v_projeto, fa.user_id, CASE fa.papel WHEN 'lider' THEN 'coordenador' ELSE 'membro' END
  FROM public.suporte_fila_agentes fa WHERE fa.fila_id = p_fila_id AND fa.ativo
  ON CONFLICT DO NOTHING;

  UPDATE public.suporte_filas SET projeto_id = v_projeto WHERE id = p_fila_id;

  INSERT INTO public.suporte_etapa_mensagens (fila_id, secao_id, mensagem, status_map, notificar) VALUES
    (p_fila_id, v_secao_espera,  'Seu chamado {protocolo} foi recebido pela equipe de {departamento} e está na fila de trabalho.', 'em_triagem', true),
    (p_fila_id, v_secao_analise, 'Boa notícia: o chamado {protocolo} está em análise — já tem alguém trabalhando no assunto.', 'em_atendimento', true),
    (p_fila_id, v_secao_fim,     'O chamado {protocolo} — {titulo} — foi concluído pela equipe de {departamento}. Se o problema persistir, basta responder por aqui.', 'resolvido', true),
    (p_fila_id, v_secao_rej,     'O chamado {protocolo} foi analisado e não seguirá adiante. A equipe de {departamento} registrou o motivo na conversa.', 'resolvido', true)
  ON CONFLICT (fila_id, secao_id) DO NOTHING;

  RETURN v_projeto;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_criar_projeto(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_criar_projeto(uuid) TO authenticated;

-- 9) rpc_suporte_fila_vincular_projeto
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_vincular_projeto(p_fila_id uuid, p_projeto_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR EXISTS (
    SELECT 1 FROM public.suporte_fila_agentes WHERE fila_id = p_fila_id AND user_id = v_uid AND ativo AND papel='lider'
  )) THEN RAISE EXCEPTION 'sem permissao'; END IF;
  IF p_projeto_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.projetos WHERE id = p_projeto_id) THEN
    RAISE EXCEPTION 'projeto invalido';
  END IF;
  UPDATE public.suporte_filas SET projeto_id = p_projeto_id WHERE id = p_fila_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_vincular_projeto(uuid,uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_vincular_projeto(uuid,uuid) TO authenticated;
