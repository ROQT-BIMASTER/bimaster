
-- =========================================================
-- 1. TABELAS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.suporte_rotinas_fixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  fila_id uuid NOT NULL REFERENCES public.suporte_filas(id) ON DELETE CASCADE,
  responsavel_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lider_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta','critica')),
  sla_primeira_resposta_min integer,
  sla_resolucao_min integer,
  horario_geracao time NOT NULL DEFAULT '07:00',
  dias_semana int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  categoria text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  gera_tarefa_projeto boolean NOT NULL DEFAULT true,
  projeto_id_espelho uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rotinas_fixas_fila ON public.suporte_rotinas_fixas(fila_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_rotinas_fixas_resp ON public.suporte_rotinas_fixas(responsavel_user_id) WHERE ativo;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suporte_rotinas_fixas TO authenticated;
GRANT ALL ON public.suporte_rotinas_fixas TO service_role;

ALTER TABLE public.suporte_rotinas_fixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rotinas_fixas_sel" ON public.suporte_rotinas_fixas FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin')
  OR responsavel_user_id = auth.uid()
  OR lider_user_id = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.suporte_fila_agentes fa
     WHERE fa.fila_id = suporte_rotinas_fixas.fila_id
       AND fa.user_id = auth.uid() AND fa.ativo
  )
);

CREATE POLICY "rotinas_fixas_ins" ON public.suporte_rotinas_fixas FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.suporte_fila_agentes fa
       WHERE fa.fila_id = suporte_rotinas_fixas.fila_id
         AND fa.user_id = auth.uid() AND fa.papel='lider' AND fa.ativo
    )
  )
);

CREATE POLICY "rotinas_fixas_upd" ON public.suporte_rotinas_fixas FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin')
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.suporte_fila_agentes fa
     WHERE fa.fila_id = suporte_rotinas_fixas.fila_id
       AND fa.user_id = auth.uid() AND fa.papel='lider' AND fa.ativo
  )
);

CREATE POLICY "rotinas_fixas_del" ON public.suporte_rotinas_fixas FOR DELETE TO authenticated
USING (has_role(auth.uid(),'admin') OR created_by = auth.uid());

-- Execuções
CREATE TABLE IF NOT EXISTS public.suporte_rotina_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id uuid NOT NULL REFERENCES public.suporte_rotinas_fixas(id) ON DELETE CASCADE,
  data_referencia date NOT NULL,
  ticket_id uuid REFERENCES public.suporte_tickets(id) ON DELETE SET NULL,
  tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL,
  protocolo text,
  status text NOT NULL DEFAULT 'gerada' CHECK (status IN ('gerada','em_andamento','concluida','violada','escalada')),
  sla_deadline timestamptz,
  concluida_em timestamptz,
  escalada_em timestamptz,
  escalada_para uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rotina_id, data_referencia)
);
CREATE INDEX IF NOT EXISTS idx_rotina_exec_ticket ON public.suporte_rotina_execucoes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_rotina_exec_status ON public.suporte_rotina_execucoes(status, sla_deadline);
CREATE INDEX IF NOT EXISTS idx_rotina_exec_data ON public.suporte_rotina_execucoes(data_referencia DESC);

GRANT SELECT ON public.suporte_rotina_execucoes TO authenticated;
GRANT ALL ON public.suporte_rotina_execucoes TO service_role;

ALTER TABLE public.suporte_rotina_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rotina_exec_sel" ON public.suporte_rotina_execucoes FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin')
  OR EXISTS (
    SELECT 1 FROM public.suporte_rotinas_fixas r
     WHERE r.id = suporte_rotina_execucoes.rotina_id
       AND (
         r.responsavel_user_id = auth.uid()
         OR r.lider_user_id = auth.uid()
         OR r.created_by = auth.uid()
         OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa
                     WHERE fa.fila_id = r.fila_id AND fa.user_id = auth.uid() AND fa.ativo)
       )
  )
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at_rotinas()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_rot_fixas_upd ON public.suporte_rotinas_fixas;
CREATE TRIGGER trg_rot_fixas_upd BEFORE UPDATE ON public.suporte_rotinas_fixas
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at_rotinas();

DROP TRIGGER IF EXISTS trg_rot_exec_upd ON public.suporte_rotina_execucoes;
CREATE TRIGGER trg_rot_exec_upd BEFORE UPDATE ON public.suporte_rotina_execucoes
FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at_rotinas();

-- =========================================================
-- 2. GERAÇÃO DIÁRIA
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_gerar_rotinas_fixas_do_dia(p_data date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data date := COALESCE(p_data, (now() AT TIME ZONE 'America/Sao_Paulo')::date);
  v_dow  int  := EXTRACT(ISODOW FROM v_data)::int; -- 1=Mon..7=Sun
  v_bot  uuid := '1ee5b9de-4864-475f-9602-ee039197e46e';
  v_criadas int := 0;
  v_puladas int := 0;
  r record;
  v_conversa_id uuid;
  v_ticket_id uuid;
  v_protocolo text;
  v_prazo_resol timestamptz;
  v_prazo_pri timestamptz;
  v_sla_res_h numeric;
  v_projeto uuid;
  v_secao uuid;
  v_tarefa uuid;
BEGIN
  -- Feriado nacional/estadual bloqueia
  IF EXISTS (SELECT 1 FROM public.feriados f
              WHERE f.data = v_data AND f.tipo IN ('nacional','estadual','empresa')) THEN
    RETURN jsonb_build_object('data', v_data, 'feriado', true, 'criadas', 0);
  END IF;

  FOR r IN
    SELECT rf.*, sf.sla_primeira_resposta_horas, sf.sla_resolucao_horas
      FROM public.suporte_rotinas_fixas rf
      JOIN public.suporte_filas sf ON sf.id = rf.fila_id AND sf.ativo AND sf.aceita_chamados
     WHERE rf.ativo
       AND v_dow = ANY(rf.dias_semana)
       AND NOT EXISTS (
         SELECT 1 FROM public.suporte_rotina_execucoes e
          WHERE e.rotina_id = rf.id AND e.data_referencia = v_data
       )
  LOOP
    -- SLA em horas (fallback para fila)
    v_sla_res_h := COALESCE(r.sla_resolucao_min::numeric/60.0, r.sla_resolucao_horas, 24);
    v_prazo_resol := (v_data::timestamp + r.horario_geracao) AT TIME ZONE 'America/Sao_Paulo'
                     + make_interval(mins => COALESCE(r.sla_resolucao_min, r.sla_resolucao_horas*60, 1440));
    v_prazo_pri := (v_data::timestamp + r.horario_geracao) AT TIME ZONE 'America/Sao_Paulo'
                     + make_interval(mins => COALESCE(r.sla_primeira_resposta_min, r.sla_primeira_resposta_horas*60, 480));

    -- Conversa em nome do responsável
    INSERT INTO public.conversas (nome, tipo, criado_por)
    VALUES (left('Rotina '||to_char(v_data,'DD/MM')||': '||r.titulo, 120), 'suporte', r.responsavel_user_id)
    RETURNING id INTO v_conversa_id;

    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    VALUES (v_conversa_id, r.responsavel_user_id, 'membro'),
           (v_conversa_id, v_bot, 'membro')
    ON CONFLICT DO NOTHING;

    IF r.lider_user_id IS NOT NULL AND r.lider_user_id <> r.responsavel_user_id THEN
      INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
      VALUES (v_conversa_id, r.lider_user_id, 'membro')
      ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT v_conversa_id, fa.user_id, 'membro'
      FROM public.suporte_fila_agentes fa
     WHERE fa.fila_id = r.fila_id AND fa.ativo
       AND fa.user_id NOT IN (r.responsavel_user_id, v_bot)
    ON CONFLICT DO NOTHING;

    -- Ticket
    INSERT INTO public.suporte_tickets
      (conversa_id, owner_id, requester_id, fila_id, canal, status, prioridade, titulo, categoria, tags,
       prazo_primeira_resposta_em, prazo_resolucao_em, sla_horas)
    VALUES
      (v_conversa_id, r.responsavel_user_id, r.responsavel_user_id, r.fila_id, 'chat_interno',
       'novo', r.prioridade, r.titulo, r.categoria,
       array_cat(r.tags, ARRAY['rotina_fixa']),
       v_prazo_pri, v_prazo_resol, GREATEST(1, v_sla_res_h::int))
    RETURNING id INTO v_ticket_id;

    v_protocolo := 'RF-'||to_char(v_data,'YYYYMMDD')||'-'||upper(substr(replace(v_ticket_id::text,'-',''),1,6));
    UPDATE public.suporte_tickets SET protocolo = v_protocolo WHERE id = v_ticket_id;

    -- Mensagem inicial descrevendo a rotina + checklist
    INSERT INTO public.mensagens (conversa_id, autor_id, conteudo, tipo)
    VALUES (v_conversa_id, v_bot,
      'Rotina fixa do dia '||to_char(v_data,'DD/MM/YYYY')||E'\n\n'||
      COALESCE(r.descricao,'')||
      CASE WHEN jsonb_array_length(r.checklist) > 0
           THEN E'\n\nChecklist:\n' ||
                (SELECT string_agg('• '||(elem->>'texto'), E'\n')
                   FROM jsonb_array_elements(r.checklist) elem)
           ELSE '' END,
      'texto');

    -- Tarefa espelho
    v_tarefa := NULL;
    IF r.gera_tarefa_projeto THEN
      v_projeto := r.projeto_id_espelho;
      IF v_projeto IS NULL THEN
        SELECT projeto_id INTO v_projeto FROM public.suporte_filas WHERE id = r.fila_id;
      END IF;
      IF v_projeto IS NOT NULL THEN
        SELECT id INTO v_secao FROM public.projeto_secoes
         WHERE projeto_id = v_projeto ORDER BY ordem ASC, created_at ASC LIMIT 1;
        IF v_secao IS NOT NULL THEN
          INSERT INTO public.projeto_tarefas
            (projeto_id, secao_id, titulo, descricao, responsavel_id, criador_id,
             status, prioridade, data_prazo, canal_criacao, tipo_tarefa)
          VALUES
            (v_projeto, v_secao,
             '['||to_char(v_data,'DD/MM')||'] '||r.titulo,
             COALESCE(r.descricao,'') || E'\n\nProtocolo: '||v_protocolo,
             r.responsavel_user_id, r.responsavel_user_id,
             'pendente', r.prioridade, v_data, 'rotina_fixa', 'padrao')
          RETURNING id INTO v_tarefa;

          UPDATE public.suporte_tickets SET projeto_tarefa_id = v_tarefa WHERE id = v_ticket_id;
        END IF;
      END IF;
    END IF;

    INSERT INTO public.suporte_rotina_execucoes
      (rotina_id, data_referencia, ticket_id, tarefa_id, protocolo, status, sla_deadline)
    VALUES
      (r.id, v_data, v_ticket_id, v_tarefa, v_protocolo, 'gerada', v_prazo_resol);

    -- Notificação para responsável
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (r.responsavel_user_id, 'rotina_fixa_criada',
            'Rotina fixa de hoje: '||r.titulo,
            'Protocolo '||v_protocolo||'. Prazo: '||to_char(v_prazo_resol AT TIME ZONE 'America/Sao_Paulo','DD/MM HH24:MI'),
            '/dashboard/suporte');

    v_criadas := v_criadas + 1;
  END LOOP;

  RETURN jsonb_build_object('data', v_data, 'feriado', false, 'criadas', v_criadas);
END $$;

REVOKE ALL ON FUNCTION public.rpc_gerar_rotinas_fixas_do_dia(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_rotinas_fixas_do_dia(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_rotinas_fixas_do_dia(date) TO authenticated;

-- =========================================================
-- 3. ESCALONAMENTO SLA
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_escalar_rotinas_sla()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int := 0; r record; v_lider uuid;
BEGIN
  FOR r IN
    SELECT e.id, e.rotina_id, e.ticket_id, e.protocolo, e.sla_deadline,
           rf.titulo, rf.lider_user_id, rf.fila_id, rf.responsavel_user_id
      FROM public.suporte_rotina_execucoes e
      JOIN public.suporte_rotinas_fixas rf ON rf.id = e.rotina_id
     WHERE e.status IN ('gerada','em_andamento')
       AND e.sla_deadline < now()
  LOOP
    v_lider := r.lider_user_id;
    IF v_lider IS NULL THEN
      SELECT fa.user_id INTO v_lider FROM public.suporte_fila_agentes fa
       WHERE fa.fila_id = r.fila_id AND fa.papel = 'lider' AND fa.ativo
       LIMIT 1;
    END IF;

    UPDATE public.suporte_rotina_execucoes
       SET status='violada', escalada_em = now(), escalada_para = v_lider
     WHERE id = r.id;

    IF r.ticket_id IS NOT NULL THEN
      UPDATE public.suporte_tickets
         SET tags = array_append(array_remove(tags,'sla_violado_rotina'),'sla_violado_rotina'),
             sla_status = 'violado',
             escalado_em = COALESCE(escalado_em, now())
       WHERE id = r.ticket_id;
    END IF;

    IF v_lider IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, action_url)
      VALUES (v_lider, 'rotina_fixa_atrasada',
              'Rotina fixa em atraso: '||r.titulo,
              'Protocolo '||COALESCE(r.protocolo,'—')||' passou do prazo. Responsável: '||r.responsavel_user_id::text,
              '/dashboard/suporte/rotinas-fixas');
    END IF;

    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('escaladas', v_count);
END $$;

REVOKE ALL ON FUNCTION public.rpc_escalar_rotinas_sla() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_escalar_rotinas_sla() TO service_role;
GRANT EXECUTE ON FUNCTION public.rpc_escalar_rotinas_sla() TO authenticated;

-- =========================================================
-- 4. CONCLUIR EXECUÇÃO
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_concluir_rotina_execucao(p_execucao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_exec record;
  v_rot record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_exec FROM public.suporte_rotina_execucoes WHERE id = p_execucao_id;
  IF v_exec.id IS NULL THEN RAISE EXCEPTION 'execucao nao encontrada'; END IF;

  SELECT * INTO v_rot FROM public.suporte_rotinas_fixas WHERE id = v_exec.rotina_id;

  IF NOT (
    has_role(v_uid,'admin')
    OR v_rot.responsavel_user_id = v_uid
    OR v_rot.lider_user_id = v_uid
    OR EXISTS (SELECT 1 FROM public.suporte_fila_agentes fa
                WHERE fa.fila_id = v_rot.fila_id AND fa.user_id = v_uid AND fa.ativo)
  ) THEN
    RAISE EXCEPTION 'sem permissao';
  END IF;

  UPDATE public.suporte_rotina_execucoes
     SET status='concluida', concluida_em = now()
   WHERE id = p_execucao_id;

  IF v_exec.ticket_id IS NOT NULL THEN
    UPDATE public.suporte_tickets
       SET status='resolvido', resolved_at = COALESCE(resolved_at, now())
     WHERE id = v_exec.ticket_id AND status <> 'resolvido';
  END IF;

  IF v_exec.tarefa_id IS NOT NULL THEN
    UPDATE public.projeto_tarefas
       SET status='concluida', data_conclusao = CURRENT_DATE
     WHERE id = v_exec.tarefa_id AND status <> 'concluida';
  END IF;

  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.rpc_concluir_rotina_execucao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_concluir_rotina_execucao(uuid) TO authenticated;

-- =========================================================
-- 5. TRIGGER: SINCRONIZAR STATUS DO TICKET COM EXECUÇÃO
-- =========================================================

CREATE OR REPLACE FUNCTION public.tg_sync_rotina_execucao_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'resolvido' AND (OLD.status IS DISTINCT FROM 'resolvido') THEN
    UPDATE public.suporte_rotina_execucoes
       SET status='concluida', concluida_em = COALESCE(concluida_em, now())
     WHERE ticket_id = NEW.id AND status NOT IN ('concluida');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_rotina_exec_ticket ON public.suporte_tickets;
CREATE TRIGGER trg_sync_rotina_exec_ticket
AFTER UPDATE OF status ON public.suporte_tickets
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_rotina_execucao_ticket();
