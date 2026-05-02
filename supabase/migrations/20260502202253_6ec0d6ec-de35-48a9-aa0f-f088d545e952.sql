-- ============================================================================
-- Fase 1 (idempotente): Kanban de Alçadas de Aprovação
-- ============================================================================

-- 1. fluxo_aprovacao_instancias: novos campos
ALTER TABLE public.fluxo_aprovacao_instancias
  ADD COLUMN IF NOT EXISTS tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS secao_id uuid REFERENCES public.projeto_secoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lote_nome text,
  ADD COLUMN IF NOT EXISTS prazo_lote date,
  ADD COLUMN IF NOT EXISTS politica_movimentacao text NOT NULL DEFAULT 'continuar';

DO $$ BEGIN
  ALTER TABLE public.fluxo_aprovacao_instancias
    ADD CONSTRAINT fai_politica_chk CHECK (politica_movimentacao IN ('continuar', 'reiniciar_etapa'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_fluxo_inst_tarefa ON public.fluxo_aprovacao_instancias(tarefa_id);
CREATE INDEX IF NOT EXISTS idx_fluxo_inst_secao ON public.fluxo_aprovacao_instancias(secao_id);

-- 2. fluxo_aprovacao_etapas: prazo
ALTER TABLE public.fluxo_aprovacao_etapas
  ADD COLUMN IF NOT EXISTS prazo_dias integer;

-- 3. china_documento_tarefa_vinculos: lote
ALTER TABLE public.china_documento_tarefa_vinculos
  ADD COLUMN IF NOT EXISTS lote_instancia_id uuid REFERENCES public.fluxo_aprovacao_instancias(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_china_dtv_lote ON public.china_documento_tarefa_vinculos(lote_instancia_id);

-- 4. fluxo_aprovacao_lote_documentos
CREATE TABLE IF NOT EXISTS public.fluxo_aprovacao_lote_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_instancias(id) ON DELETE CASCADE,
  documento_id uuid NOT NULL REFERENCES public.china_produto_documentos(id) ON DELETE CASCADE,
  vinculo_tarefa_id uuid REFERENCES public.china_documento_tarefa_vinculos(id) ON DELETE SET NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, documento_id)
);

CREATE INDEX IF NOT EXISTS idx_falde_instancia ON public.fluxo_aprovacao_lote_documentos(instancia_id);
CREATE INDEX IF NOT EXISTS idx_falde_documento ON public.fluxo_aprovacao_lote_documentos(documento_id);

ALTER TABLE public.fluxo_aprovacao_lote_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "falde_select" ON public.fluxo_aprovacao_lote_documentos;
CREATE POLICY "falde_select" ON public.fluxo_aprovacao_lote_documentos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fluxo_aprovacao_instancias fai
      JOIN public.projeto_tarefas pt ON pt.id = fai.tarefa_id
      WHERE fai.id = fluxo_aprovacao_lote_documentos.instancia_id
        AND (
          pt.projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = (select auth.uid()))
          OR has_role((select auth.uid()), 'admin'::app_role)
          OR has_role((select auth.uid()), 'supervisor'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "falde_insert" ON public.fluxo_aprovacao_lote_documentos;
CREATE POLICY "falde_insert" ON public.fluxo_aprovacao_lote_documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.fluxo_aprovacao_instancias fai
      JOIN public.projeto_tarefas pt ON pt.id = fai.tarefa_id
      WHERE fai.id = fluxo_aprovacao_lote_documentos.instancia_id
        AND pt.projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "falde_delete" ON public.fluxo_aprovacao_lote_documentos;
CREATE POLICY "falde_delete" ON public.fluxo_aprovacao_lote_documentos
  FOR DELETE TO authenticated
  USING (
    created_by = (select auth.uid())
    OR has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
  );

-- 5. fluxo_aprovacao_etapa_eventos
CREATE TABLE IF NOT EXISTS public.fluxo_aprovacao_etapa_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.fluxo_aprovacao_instancias(id) ON DELETE CASCADE,
  etapa_ordem integer NOT NULL,
  etapa_nome text,
  rodada integer NOT NULL DEFAULT 1,
  responsavel_id uuid REFERENCES auth.users(id),
  entrou_em timestamp with time zone NOT NULL DEFAULT now(),
  prazo_em timestamp with time zone,
  concluido_em timestamp with time zone,
  decisao text NOT NULL DEFAULT 'pendente',
  decidido_por uuid REFERENCES auth.users(id),
  comentario text,
  assinado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE public.fluxo_aprovacao_etapa_eventos
    ADD CONSTRAINT faee_decisao_chk CHECK (decisao IN ('pendente', 'aprovado', 'rejeitado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_faee_instancia ON public.fluxo_aprovacao_etapa_eventos(instancia_id, etapa_ordem, rodada);
CREATE INDEX IF NOT EXISTS idx_faee_pendente ON public.fluxo_aprovacao_etapa_eventos(instancia_id) WHERE decisao = 'pendente';
CREATE INDEX IF NOT EXISTS idx_faee_responsavel ON public.fluxo_aprovacao_etapa_eventos(responsavel_id) WHERE decisao = 'pendente';

ALTER TABLE public.fluxo_aprovacao_etapa_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faee_select" ON public.fluxo_aprovacao_etapa_eventos;
CREATE POLICY "faee_select" ON public.fluxo_aprovacao_etapa_eventos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fluxo_aprovacao_instancias fai
      JOIN public.projeto_tarefas pt ON pt.id = fai.tarefa_id
      WHERE fai.id = fluxo_aprovacao_etapa_eventos.instancia_id
        AND (
          pt.projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = (select auth.uid()))
          OR has_role((select auth.uid()), 'admin'::app_role)
          OR has_role((select auth.uid()), 'supervisor'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "faee_insert" ON public.fluxo_aprovacao_etapa_eventos;
CREATE POLICY "faee_insert" ON public.fluxo_aprovacao_etapa_eventos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fluxo_aprovacao_instancias fai
      JOIN public.projeto_tarefas pt ON pt.id = fai.tarefa_id
      WHERE fai.id = fluxo_aprovacao_etapa_eventos.instancia_id
        AND pt.projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "faee_update" ON public.fluxo_aprovacao_etapa_eventos;
CREATE POLICY "faee_update" ON public.fluxo_aprovacao_etapa_eventos
  FOR UPDATE TO authenticated
  USING (
    responsavel_id = (select auth.uid())
    OR has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
  );

-- 6. RLS endurecido em fluxo_aprovacao_instancias
DROP POLICY IF EXISTS "Authenticated can insert instances" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "Authenticated can read instances" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "Authenticated can update instances" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "fai_select" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "fai_insert" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "fai_update" ON public.fluxo_aprovacao_instancias;
DROP POLICY IF EXISTS "fai_delete" ON public.fluxo_aprovacao_instancias;

CREATE POLICY "fai_select" ON public.fluxo_aprovacao_instancias
  FOR SELECT TO authenticated
  USING (
    tarefa_id IS NULL
    OR tarefa_id IN (
      SELECT pt.id FROM public.projeto_tarefas pt
      WHERE pt.projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = (select auth.uid()))
    )
    OR has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
  );

CREATE POLICY "fai_insert" ON public.fluxo_aprovacao_instancias
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (select auth.uid())
    AND (
      tarefa_id IS NULL
      OR tarefa_id IN (
        SELECT pt.id FROM public.projeto_tarefas pt
        WHERE pt.projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = (select auth.uid()))
      )
    )
  );

CREATE POLICY "fai_update" ON public.fluxo_aprovacao_instancias
  FOR UPDATE TO authenticated
  USING (
    created_by = (select auth.uid())
    OR has_role((select auth.uid()), 'admin'::app_role)
    OR has_role((select auth.uid()), 'supervisor'::app_role)
    OR tarefa_id IN (
      SELECT pt.id FROM public.projeto_tarefas pt
      WHERE pt.projeto_id IN (SELECT projeto_id FROM public.projeto_membros WHERE user_id = (select auth.uid()))
    )
  );

CREATE POLICY "fai_delete" ON public.fluxo_aprovacao_instancias
  FOR DELETE TO authenticated
  USING (
    created_by = (select auth.uid())
    OR has_role((select auth.uid()), 'admin'::app_role)
  );

-- 7. Trigger log atividade
CREATE OR REPLACE FUNCTION public.log_aprovacao_etapa_evento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_projeto_id uuid; v_lote_nome text; v_tarefa_id uuid;
  v_descricao text; v_tipo text; v_actor uuid;
BEGIN
  SELECT fai.tarefa_id, pt.projeto_id, fai.lote_nome
    INTO v_tarefa_id, v_projeto_id, v_lote_nome
  FROM public.fluxo_aprovacao_instancias fai
  JOIN public.projeto_tarefas pt ON pt.id = fai.tarefa_id
  WHERE fai.id = NEW.instancia_id;

  IF v_projeto_id IS NULL THEN RETURN NEW; END IF;

  v_actor := COALESCE(NEW.decidido_por, NEW.responsavel_id);
  IF v_actor IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    v_tipo := 'aprovacao_etapa_aberta';
    v_descricao := format('Lote "%s": etapa %s (rodada %s) aguardando decisão',
                         COALESCE(v_lote_nome, 'sem nome'),
                         COALESCE(NEW.etapa_nome, NEW.etapa_ordem::text),
                         NEW.rodada);
  ELSIF TG_OP = 'UPDATE' AND OLD.decisao = 'pendente' AND NEW.decisao <> 'pendente' THEN
    v_tipo := CASE WHEN NEW.decisao = 'aprovado' THEN 'aprovacao_etapa_aprovada'
                   ELSE 'aprovacao_etapa_rejeitada' END;
    v_descricao := format('Lote "%s": etapa %s (rodada %s) %s',
                         COALESCE(v_lote_nome, 'sem nome'),
                         COALESCE(NEW.etapa_nome, NEW.etapa_ordem::text),
                         NEW.rodada, NEW.decisao);
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.projeto_atividades (projeto_id, tarefa_id, user_id, tipo, descricao, metadata)
  VALUES (v_projeto_id, v_tarefa_id, v_actor, v_tipo, v_descricao,
          jsonb_build_object('instancia_id', NEW.instancia_id,
                             'etapa_ordem', NEW.etapa_ordem,
                             'rodada', NEW.rodada, 'decisao', NEW.decisao));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_log_faee ON public.fluxo_aprovacao_etapa_eventos;
CREATE TRIGGER trg_log_faee
AFTER INSERT OR UPDATE ON public.fluxo_aprovacao_etapa_eventos
FOR EACH ROW EXECUTE FUNCTION public.log_aprovacao_etapa_evento();

-- 8. updated_at trigger
CREATE OR REPLACE FUNCTION public.update_faee_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_faee_updated ON public.fluxo_aprovacao_etapa_eventos;
CREATE TRIGGER trg_faee_updated
BEFORE UPDATE ON public.fluxo_aprovacao_etapa_eventos
FOR EACH ROW EXECUTE FUNCTION public.update_faee_timestamp();

-- 9. RPC avançar etapa
CREATE OR REPLACE FUNCTION public.rpc_avancar_etapa_aprovacao(
  p_instancia_id uuid, p_decisao text, p_comentario text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_evento RECORD; v_inst RECORD; v_proxima RECORD; v_anterior RECORD;
  v_uid uuid := auth.uid(); v_nova_rodada int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_decisao NOT IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'Decisão inválida'; END IF;

  SELECT * INTO v_inst FROM public.fluxo_aprovacao_instancias
    WHERE id = p_instancia_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;

  SELECT * INTO v_evento FROM public.fluxo_aprovacao_etapa_eventos
    WHERE instancia_id = p_instancia_id AND decisao = 'pendente'
    ORDER BY entrou_em DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nenhuma etapa pendente'; END IF;

  IF v_evento.responsavel_id <> v_uid
     AND NOT has_role(v_uid, 'admin'::app_role)
     AND NOT has_role(v_uid, 'supervisor'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.fluxo_aprovacao_etapa_eventos
  SET decisao = p_decisao, decidido_por = v_uid, comentario = p_comentario,
      concluido_em = now(), assinado_em = now()
  WHERE id = v_evento.id;

  IF p_decisao = 'aprovado' THEN
    SELECT * INTO v_proxima FROM public.fluxo_aprovacao_etapas
      WHERE config_id = v_inst.config_id AND ordem > v_evento.etapa_ordem AND ativo
      ORDER BY ordem ASC LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.fluxo_aprovacao_etapa_eventos
        (instancia_id, etapa_ordem, etapa_nome, rodada, responsavel_id, prazo_em)
      VALUES (p_instancia_id, v_proxima.ordem, v_proxima.nome, 1, v_proxima.responsavel_id,
        CASE WHEN v_proxima.prazo_dias IS NOT NULL
             THEN now() + (v_proxima.prazo_dias || ' days')::interval ELSE NULL END);
      UPDATE public.fluxo_aprovacao_instancias
      SET etapa_atual_ordem = v_proxima.ordem, status = 'pendente', updated_at = now()
      WHERE id = p_instancia_id;
    ELSE
      UPDATE public.fluxo_aprovacao_instancias
      SET status = 'aprovado', updated_at = now() WHERE id = p_instancia_id;
    END IF;
  ELSE
    SELECT * INTO v_anterior FROM public.fluxo_aprovacao_etapas
      WHERE config_id = v_inst.config_id AND ordem < v_evento.etapa_ordem AND ativo
      ORDER BY ordem DESC LIMIT 1;
    IF NOT FOUND THEN
      SELECT * INTO v_anterior FROM public.fluxo_aprovacao_etapas
        WHERE config_id = v_inst.config_id AND ativo ORDER BY ordem ASC LIMIT 1;
    END IF;

    SELECT COALESCE(MAX(rodada), 0) + 1 INTO v_nova_rodada
    FROM public.fluxo_aprovacao_etapa_eventos
    WHERE instancia_id = p_instancia_id AND etapa_ordem = v_anterior.ordem;

    INSERT INTO public.fluxo_aprovacao_etapa_eventos
      (instancia_id, etapa_ordem, etapa_nome, rodada, responsavel_id, prazo_em)
    VALUES (p_instancia_id, v_anterior.ordem, v_anterior.nome, v_nova_rodada,
      v_anterior.responsavel_id,
      CASE WHEN v_anterior.prazo_dias IS NOT NULL
           THEN now() + (v_anterior.prazo_dias || ' days')::interval ELSE NULL END);

    UPDATE public.fluxo_aprovacao_instancias
    SET etapa_atual_ordem = v_anterior.ordem, status = 'pendente',
        rodada = v_nova_rodada, updated_at = now()
    WHERE id = p_instancia_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE ALL ON FUNCTION public.rpc_avancar_etapa_aprovacao(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_avancar_etapa_aprovacao(uuid, text, text) TO authenticated;

-- 10. RPC mover lote
CREATE OR REPLACE FUNCTION public.rpc_mover_lote_para_tarefa(
  p_instancia_id uuid, p_nova_tarefa_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inst RECORD; v_nova RECORD; v_uid uuid := auth.uid();
  v_evento RECORD; v_etapa RECORD; v_nova_rodada int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_inst FROM public.fluxo_aprovacao_instancias
    WHERE id = p_instancia_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;

  SELECT pt.id, pt.projeto_id, pt.secao_id INTO v_nova
  FROM public.projeto_tarefas pt WHERE pt.id = p_nova_tarefa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa destino não encontrada'; END IF;

  IF v_inst.created_by <> v_uid
     AND NOT has_role(v_uid, 'admin'::app_role)
     AND NOT has_role(v_uid, 'supervisor'::app_role)
     AND NOT EXISTS (SELECT 1 FROM public.projeto_membros
                     WHERE projeto_id = v_nova.projeto_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.fluxo_aprovacao_instancias
  SET tarefa_id = p_nova_tarefa_id, secao_id = v_nova.secao_id, updated_at = now()
  WHERE id = p_instancia_id;

  IF v_inst.politica_movimentacao = 'reiniciar_etapa' THEN
    SELECT * INTO v_evento FROM public.fluxo_aprovacao_etapa_eventos
      WHERE instancia_id = p_instancia_id AND decisao = 'pendente'
      ORDER BY entrou_em DESC LIMIT 1;
    IF FOUND THEN
      UPDATE public.fluxo_aprovacao_etapa_eventos
      SET decisao = 'rejeitado', concluido_em = now(),
          comentario = COALESCE(comentario, '') || ' [reiniciada por movimentação]',
          decidido_por = v_uid
      WHERE id = v_evento.id;

      SELECT * INTO v_etapa FROM public.fluxo_aprovacao_etapas
        WHERE config_id = v_inst.config_id AND ordem = v_evento.etapa_ordem LIMIT 1;

      SELECT COALESCE(MAX(rodada), 0) + 1 INTO v_nova_rodada
      FROM public.fluxo_aprovacao_etapa_eventos
      WHERE instancia_id = p_instancia_id AND etapa_ordem = v_evento.etapa_ordem;

      INSERT INTO public.fluxo_aprovacao_etapa_eventos
        (instancia_id, etapa_ordem, etapa_nome, rodada, responsavel_id, prazo_em)
      VALUES (p_instancia_id, v_evento.etapa_ordem, v_evento.etapa_nome,
        v_nova_rodada, v_etapa.responsavel_id,
        CASE WHEN v_etapa.prazo_dias IS NOT NULL
             THEN now() + (v_etapa.prazo_dias || ' days')::interval ELSE NULL END);
    END IF;
  END IF;

  INSERT INTO public.projeto_atividades (projeto_id, tarefa_id, user_id, tipo, descricao, metadata)
  VALUES (v_nova.projeto_id, p_nova_tarefa_id, v_uid, 'aprovacao_lote_movido',
    format('Lote "%s" movido (política: %s)', COALESCE(v_inst.lote_nome, '?'), v_inst.politica_movimentacao),
    jsonb_build_object('instancia_id', p_instancia_id,
                       'tarefa_origem', v_inst.tarefa_id,
                       'tarefa_destino', p_nova_tarefa_id,
                       'politica', v_inst.politica_movimentacao));

  RETURN jsonb_build_object('ok', true);
END; $$;

REVOKE ALL ON FUNCTION public.rpc_mover_lote_para_tarefa(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_mover_lote_para_tarefa(uuid, uuid) TO authenticated;

-- 11. RPC criar lote
CREATE OR REPLACE FUNCTION public.rpc_criar_lote_aprovacao(
  p_tarefa_id uuid, p_config_id uuid, p_lote_nome text,
  p_documento_ids uuid[], p_prazo_lote date DEFAULT NULL,
  p_politica text DEFAULT 'continuar'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_tarefa RECORD; v_inst_id uuid;
  v_primeira RECORD; v_doc_id uuid; v_ordem int := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_lote_nome IS NULL OR length(trim(p_lote_nome)) = 0 THEN
    RAISE EXCEPTION 'Nome do lote é obrigatório'; END IF;
  IF p_politica NOT IN ('continuar', 'reiniciar_etapa') THEN
    RAISE EXCEPTION 'Política inválida'; END IF;

  SELECT pt.id, pt.projeto_id, pt.secao_id INTO v_tarefa
  FROM public.projeto_tarefas pt WHERE pt.id = p_tarefa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.projeto_membros
                 WHERE projeto_id = v_tarefa.projeto_id AND user_id = v_uid)
     AND NOT has_role(v_uid, 'admin'::app_role)
     AND NOT has_role(v_uid, 'supervisor'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão no projeto';
  END IF;

  INSERT INTO public.fluxo_aprovacao_instancias
    (config_id, tarefa_id, secao_id, projeto_id, lote_nome, prazo_lote,
     politica_movimentacao, etapa_atual_ordem, status, rodada, created_by, titulo)
  VALUES (p_config_id, p_tarefa_id, v_tarefa.secao_id, v_tarefa.projeto_id,
    p_lote_nome, p_prazo_lote, p_politica, 0, 'pendente', 1, v_uid, p_lote_nome)
  RETURNING id INTO v_inst_id;

  IF p_documento_ids IS NOT NULL THEN
    FOREACH v_doc_id IN ARRAY p_documento_ids LOOP
      INSERT INTO public.fluxo_aprovacao_lote_documentos
        (instancia_id, documento_id, ordem, created_by)
      VALUES (v_inst_id, v_doc_id, v_ordem, v_uid)
      ON CONFLICT DO NOTHING;
      v_ordem := v_ordem + 1;
    END LOOP;

    UPDATE public.china_documento_tarefa_vinculos
    SET lote_instancia_id = v_inst_id
    WHERE tarefa_id = p_tarefa_id AND documento_id = ANY(p_documento_ids);
  END IF;

  SELECT * INTO v_primeira FROM public.fluxo_aprovacao_etapas
    WHERE config_id = p_config_id AND ativo ORDER BY ordem ASC LIMIT 1;
  IF FOUND THEN
    INSERT INTO public.fluxo_aprovacao_etapa_eventos
      (instancia_id, etapa_ordem, etapa_nome, rodada, responsavel_id, prazo_em)
    VALUES (v_inst_id, v_primeira.ordem, v_primeira.nome, 1, v_primeira.responsavel_id,
      CASE WHEN v_primeira.prazo_dias IS NOT NULL
           THEN now() + (v_primeira.prazo_dias || ' days')::interval ELSE NULL END);
    UPDATE public.fluxo_aprovacao_instancias
    SET etapa_atual_ordem = v_primeira.ordem WHERE id = v_inst_id;
  END IF;

  INSERT INTO public.projeto_atividades (projeto_id, tarefa_id, user_id, tipo, descricao, metadata)
  VALUES (v_tarefa.projeto_id, p_tarefa_id, v_uid, 'aprovacao_lote_criado',
    format('Lote "%s" criado com %s documento(s)',
           p_lote_nome, COALESCE(array_length(p_documento_ids, 1), 0)),
    jsonb_build_object('instancia_id', v_inst_id, 'config_id', p_config_id));

  RETURN v_inst_id;
END; $$;

REVOKE ALL ON FUNCTION public.rpc_criar_lote_aprovacao(uuid, uuid, text, uuid[], date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_criar_lote_aprovacao(uuid, uuid, text, uuid[], date, text) TO authenticated;

-- 12. Realtime
ALTER TABLE public.fluxo_aprovacao_instancias REPLICA IDENTITY FULL;
ALTER TABLE public.fluxo_aprovacao_etapa_eventos REPLICA IDENTITY FULL;
ALTER TABLE public.fluxo_aprovacao_lote_documentos REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.fluxo_aprovacao_instancias;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.fluxo_aprovacao_etapa_eventos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.fluxo_aprovacao_lote_documentos;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;