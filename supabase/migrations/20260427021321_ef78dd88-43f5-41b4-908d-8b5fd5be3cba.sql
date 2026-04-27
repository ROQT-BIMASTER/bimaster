
ALTER TABLE public.processo_etapa_tarefas_template
  ADD COLUMN IF NOT EXISTS modo TEXT NOT NULL DEFAULT 'criar'
    CHECK (modo IN ('criar','espelhar_tarefa','espelhar_secao')),
  ADD COLUMN IF NOT EXISTS espelho_projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS espelho_secao_id UUID REFERENCES public.projeto_secoes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS espelho_tarefa_id UUID REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exige_documentos BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.processo_tarefa_espelho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id UUID NOT NULL REFERENCES public.processo_instancias(id) ON DELETE CASCADE,
  etapa_id UUID NOT NULL REFERENCES public.processo_perfil_etapas(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.processo_etapa_tarefas_template(id) ON DELETE SET NULL,
  projeto_tarefa_id UUID REFERENCES public.projeto_tarefas(id) ON DELETE CASCADE,
  projeto_secao_id UUID REFERENCES public.projeto_secoes(id) ON DELETE SET NULL,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  exige_documentos BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  concluida_em TIMESTAMPTZ,
  concluida_por UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, etapa_id, projeto_tarefa_id)
);

CREATE INDEX IF NOT EXISTS idx_pte_instancia ON public.processo_tarefa_espelho(instancia_id);
CREATE INDEX IF NOT EXISTS idx_pte_tarefa ON public.processo_tarefa_espelho(projeto_tarefa_id);
CREATE INDEX IF NOT EXISTS idx_pte_etapa ON public.processo_tarefa_espelho(etapa_id);

ALTER TABLE public.processo_tarefa_espelho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem espelhos"
  ON public.processo_tarefa_espelho FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin e gerente gerenciam espelhos"
  ON public.processo_tarefa_espelho FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gerente'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gerente'::app_role));

CREATE TRIGGER trg_pte_updated_at
  BEFORE UPDATE ON public.processo_tarefa_espelho
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validar_docs_obrigatorios_espelho(p_espelho_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_esp record; v_doc record; v_status record; v_checklist jsonb; v_pendentes jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_esp FROM processo_tarefa_espelho WHERE id = p_espelho_id;
  IF v_esp IS NULL THEN RETURN jsonb_build_object('ok', false, 'erro', 'espelho não encontrado'); END IF;
  IF NOT v_esp.exige_documentos THEN RETURN jsonb_build_object('ok', true, 'pendentes', '[]'::jsonb); END IF;
  SELECT * INTO v_status FROM processo_instancia_etapa_status
   WHERE instancia_id = v_esp.instancia_id AND etapa_id = v_esp.etapa_id;
  v_checklist := COALESCE(v_status.checklist_status, '{}'::jsonb);
  FOR v_doc IN SELECT * FROM processo_etapa_documentos WHERE etapa_id = v_esp.etapa_id AND obrigatorio = true LOOP
    IF NOT (COALESCE((v_checklist->'documentos'->v_doc.tipo)::text,'false') = 'true') THEN
      v_pendentes := v_pendentes || jsonb_build_object('codigo', v_doc.tipo, 'label', v_doc.label);
    END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', jsonb_array_length(v_pendentes) = 0, 'pendentes', v_pendentes);
END; $$;

CREATE OR REPLACE FUNCTION public.sync_espelho_on_tarefa_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_esp record; v_check jsonb; v_pendente_labels text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    FOR v_esp IN SELECT * FROM processo_tarefa_espelho WHERE projeto_tarefa_id = NEW.id LOOP
      IF NEW.status = 'concluida' THEN
        v_check := public.validar_docs_obrigatorios_espelho(v_esp.id);
        IF NOT (v_check->>'ok')::boolean THEN
          SELECT string_agg(e->>'label', ', ') INTO v_pendente_labels
            FROM jsonb_array_elements(v_check->'pendentes') e;
          RAISE EXCEPTION 'Não é possível concluir esta tarefa: documentos oficiais pendentes da etapa do processo (%). Anexe-os antes de marcar como concluída.', v_pendente_labels USING ERRCODE = 'P0001';
        END IF;
        UPDATE processo_tarefa_espelho SET status='concluida', concluida_em=now(), concluida_por=auth.uid() WHERE id=v_esp.id;
      ELSIF NEW.status IN ('pendente','em_andamento') THEN
        UPDATE processo_tarefa_espelho
           SET status = CASE WHEN NEW.status = 'em_andamento' THEN 'em_andamento' ELSE 'pendente' END,
               concluida_em = NULL, concluida_por = NULL
         WHERE id = v_esp.id AND status <> 'concluida';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_espelho_tarefa ON public.projeto_tarefas;
CREATE TRIGGER trg_sync_espelho_tarefa
  AFTER UPDATE OF status ON public.projeto_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.sync_espelho_on_tarefa_status();

CREATE OR REPLACE FUNCTION public.sync_tarefa_on_espelho_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_t_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'concluida' AND OLD.status <> 'concluida' AND NEW.projeto_tarefa_id IS NOT NULL THEN
    SELECT status INTO v_t_status FROM projeto_tarefas WHERE id = NEW.projeto_tarefa_id;
    IF v_t_status IS DISTINCT FROM 'concluida' THEN
      UPDATE projeto_tarefas SET status='concluida', data_conclusao = COALESCE(data_conclusao, now()) WHERE id = NEW.projeto_tarefa_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_tarefa_espelho ON public.processo_tarefa_espelho;
CREATE TRIGGER trg_sync_tarefa_espelho
  AFTER UPDATE OF status ON public.processo_tarefa_espelho
  FOR EACH ROW EXECUTE FUNCTION public.sync_tarefa_on_espelho_status();

CREATE OR REPLACE FUNCTION public.gerar_tarefas_etapa(p_instancia_id uuid, p_etapa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid(); v_projeto_id uuid; v_secao_id uuid; v_tpl record; v_sub jsonb;
  v_tarefa_id uuid; v_sub_id uuid; v_count_tarefas int := 0; v_count_subs int := 0; v_count_espelhos int := 0;
  v_etapa record; v_inst record; v_prazo date; v_existing uuid; v_t record;
BEGIN
  SELECT * INTO v_etapa FROM processo_perfil_etapas WHERE id = p_etapa_id;
  SELECT * INTO v_inst FROM processo_instancias WHERE id = p_instancia_id;
  IF v_etapa IS NULL OR v_inst IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'etapa ou instância inválida');
  END IF;
  v_projeto_id := public.resolver_projeto_da_instancia(p_instancia_id);

  FOR v_tpl IN SELECT * FROM processo_etapa_tarefas_template WHERE etapa_id = p_etapa_id AND auto_gerar = true ORDER BY ordem ASC LOOP
    IF v_tpl.modo = 'espelhar_tarefa' AND v_tpl.espelho_tarefa_id IS NOT NULL THEN
      INSERT INTO processo_tarefa_espelho (instancia_id, etapa_id, template_id, projeto_tarefa_id, projeto_secao_id, projeto_id, exige_documentos, created_by)
      VALUES (p_instancia_id, p_etapa_id, v_tpl.id, v_tpl.espelho_tarefa_id, v_tpl.espelho_secao_id, v_tpl.espelho_projeto_id, v_tpl.exige_documentos, v_user)
      ON CONFLICT (instancia_id, etapa_id, projeto_tarefa_id) DO NOTHING;
      v_count_espelhos := v_count_espelhos + 1;
      CONTINUE;
    ELSIF v_tpl.modo = 'espelhar_secao' AND v_tpl.espelho_secao_id IS NOT NULL THEN
      FOR v_t IN SELECT id, secao_id FROM projeto_tarefas WHERE secao_id = v_tpl.espelho_secao_id AND parent_tarefa_id IS NULL LOOP
        INSERT INTO processo_tarefa_espelho (instancia_id, etapa_id, template_id, projeto_tarefa_id, projeto_secao_id, projeto_id, exige_documentos, created_by)
        VALUES (p_instancia_id, p_etapa_id, v_tpl.id, v_t.id, v_t.secao_id, v_tpl.espelho_projeto_id, v_tpl.exige_documentos, v_user)
        ON CONFLICT (instancia_id, etapa_id, projeto_tarefa_id) DO NOTHING;
        v_count_espelhos := v_count_espelhos + 1;
      END LOOP;
      CONTINUE;
    END IF;

    IF v_projeto_id IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_secao_id FROM projeto_secoes WHERE projeto_id = v_projeto_id ORDER BY ordem ASC LIMIT 1;
    IF v_secao_id IS NULL THEN
      INSERT INTO projeto_secoes (projeto_id, nome, ordem) VALUES (v_projeto_id, COALESCE(v_etapa.label, 'Etapa do processo'), 0) RETURNING id INTO v_secao_id;
    END IF;

    SELECT tarefa_id INTO v_existing FROM processo_instancia_tarefa_gerada
     WHERE instancia_id = p_instancia_id AND etapa_id = p_etapa_id AND template_id = v_tpl.id;
    IF v_existing IS NOT NULL THEN CONTINUE; END IF;

    v_prazo := (CURRENT_DATE + COALESCE(v_tpl.prazo_dias, v_etapa.prazo_padrao_dias, 5));

    INSERT INTO projeto_tarefas (projeto_id, secao_id, titulo, descricao, status, prioridade, data_prazo, criador_id, tipo_tarefa)
    VALUES (v_projeto_id, v_secao_id, v_tpl.titulo,
      COALESCE(v_tpl.descricao, '') || E'\n\n[Gerada automaticamente pelo processo • etapa: ' || v_etapa.label || ']',
      'pendente', COALESCE(v_tpl.prioridade, 'media'), v_prazo, v_user, 'padrao')
    RETURNING id INTO v_tarefa_id;

    INSERT INTO processo_instancia_tarefa_gerada (instancia_id, etapa_id, template_id, tarefa_id, modulo_codigo)
    VALUES (p_instancia_id, p_etapa_id, v_tpl.id, v_tarefa_id, v_tpl.modulo_codigo);
    v_count_tarefas := v_count_tarefas + 1;

    IF v_tpl.subtarefas IS NOT NULL AND jsonb_typeof(v_tpl.subtarefas) = 'array' THEN
      FOR v_sub IN SELECT * FROM jsonb_array_elements(v_tpl.subtarefas) LOOP
        INSERT INTO projeto_tarefas (projeto_id, secao_id, parent_tarefa_id, titulo, status, prioridade, data_prazo, criador_id, tipo_tarefa)
        VALUES (v_projeto_id, v_secao_id, v_tarefa_id, COALESCE(v_sub->>'titulo', v_sub#>>'{}'),
          'pendente', COALESCE(v_sub->>'prioridade', v_tpl.prioridade, 'media'),
          (CURRENT_DATE + COALESCE((v_sub->>'prazo_dias')::int, v_tpl.prazo_dias, 3)), v_user, 'padrao')
        RETURNING id INTO v_sub_id;
        v_count_subs := v_count_subs + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'projeto_id', v_projeto_id,
    'tarefas_criadas', v_count_tarefas, 'subtarefas_criadas', v_count_subs, 'espelhos_criados', v_count_espelhos);
END; $function$;

CREATE OR REPLACE FUNCTION public.pode_avancar_etapa(p_instancia_id uuid, p_etapa_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_pendencias jsonb := '[]'::jsonb;
  v_etapa record; v_status record; v_doc record; v_mod record; v_link_status text;
  v_checklist jsonb; v_total_tarefas int; v_tarefas_concluidas int;
  v_ref record; v_t_status text; v_t_titulo text; v_s_nome text;
  v_p_status text; v_p_nome text; v_total_secao int; v_concluidas_secao int; v_esp record;
BEGIN
  SELECT * INTO v_etapa FROM processo_perfil_etapas WHERE id = p_etapa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('pode', false, 'pendencias', jsonb_build_array(jsonb_build_object('tipo','erro','label','Etapa não encontrada')));
  END IF;
  SELECT * INTO v_status FROM processo_instancia_etapa_status WHERE instancia_id = p_instancia_id AND etapa_id = p_etapa_id;
  v_checklist := COALESCE(v_status.checklist_status, '{}'::jsonb);

  FOR v_doc IN SELECT * FROM processo_etapa_documentos WHERE etapa_id = p_etapa_id AND obrigatorio = true LOOP
    IF NOT (COALESCE((v_checklist->'documentos'->v_doc.tipo)::text,'false') = 'true') THEN
      v_pendencias := v_pendencias || jsonb_build_object('tipo','documento','label',v_doc.label,'codigo',v_doc.tipo);
    END IF;
  END LOOP;

  SELECT COUNT(*) INTO v_total_tarefas FROM processo_etapa_tarefas_template WHERE etapa_id = p_etapa_id;
  v_tarefas_concluidas := COALESCE(jsonb_array_length(v_checklist->'tarefas_concluidas'),0);
  IF v_total_tarefas > 0 AND v_tarefas_concluidas < v_total_tarefas THEN
    v_pendencias := v_pendencias || jsonb_build_object('tipo','tarefa',
      'label', format('Tarefas pendentes (%s/%s concluídas)', v_tarefas_concluidas, v_total_tarefas));
  END IF;

  FOR v_mod IN SELECT pem.*, pmc.label AS catalogo_label FROM processo_etapa_modulos pem
    LEFT JOIN processo_modulo_catalogo pmc ON pmc.codigo = pem.modulo_codigo
    WHERE pem.etapa_id = p_etapa_id AND pem.bloqueia_avanco = true LOOP
    SELECT status INTO v_link_status FROM modulo_processo_link
      WHERE instancia_id = p_instancia_id AND etapa_id = p_etapa_id AND modulo_codigo = v_mod.modulo_codigo
      ORDER BY updated_at DESC LIMIT 1;
    IF v_link_status IS NULL OR v_link_status <> 'concluido' THEN
      v_pendencias := v_pendencias || jsonb_build_object('tipo','modulo',
        'label', format('Módulo %s não concluído', COALESCE(v_mod.label, v_mod.catalogo_label, v_mod.modulo_codigo)),
        'codigo', v_mod.modulo_codigo);
    END IF;
  END LOOP;

  FOR v_ref IN SELECT * FROM processo_etapa_projeto_refs WHERE etapa_id = p_etapa_id AND bloqueia_avanco = true LOOP
    IF v_ref.tarefa_id IS NOT NULL THEN
      SELECT status, titulo INTO v_t_status, v_t_titulo FROM projeto_tarefas WHERE id = v_ref.tarefa_id;
      IF v_t_status IS DISTINCT FROM 'concluida' THEN
        v_pendencias := v_pendencias || jsonb_build_object('tipo','projeto_ref','label', format('Tarefa pendente: %s', COALESCE(v_t_titulo,'(removida)')));
      END IF;
    ELSIF v_ref.secao_id IS NOT NULL THEN
      SELECT nome INTO v_s_nome FROM projeto_secoes WHERE id = v_ref.secao_id;
      SELECT COUNT(*) FILTER (WHERE status = 'concluida'), COUNT(*) INTO v_concluidas_secao, v_total_secao
        FROM projeto_tarefas WHERE secao_id = v_ref.secao_id;
      IF v_total_secao = 0 OR v_concluidas_secao < v_total_secao THEN
        v_pendencias := v_pendencias || jsonb_build_object('tipo','projeto_ref',
          'label', format('Seção pendente: %s (%s/%s)', COALESCE(v_s_nome,'(removida)'), v_concluidas_secao, v_total_secao));
      END IF;
    ELSE
      SELECT status, nome INTO v_p_status, v_p_nome FROM projetos WHERE id = v_ref.projeto_id;
      IF v_p_status IS DISTINCT FROM 'concluido' AND v_p_status IS DISTINCT FROM 'finalizado' THEN
        v_pendencias := v_pendencias || jsonb_build_object('tipo','projeto_ref','label', format('Projeto não concluído: %s', COALESCE(v_p_nome,'(removido)')));
      END IF;
    END IF;
  END LOOP;

  FOR v_esp IN
    SELECT pte.*, pt.titulo AS t_titulo, pt.status AS t_status
      FROM processo_tarefa_espelho pte
      LEFT JOIN projeto_tarefas pt ON pt.id = pte.projeto_tarefa_id
     WHERE pte.instancia_id = p_instancia_id AND pte.etapa_id = p_etapa_id
  LOOP
    IF COALESCE(v_esp.t_status, v_esp.status) <> 'concluida' THEN
      v_pendencias := v_pendencias || jsonb_build_object('tipo','tarefa_espelho',
        'label', format('Tarefa-espelho pendente: %s', COALESCE(v_esp.t_titulo,'(removida)')),
        'projeto_tarefa_id', v_esp.projeto_tarefa_id);
    END IF;
  END LOOP;

  IF v_etapa.requer_aprovacao AND v_status.aprovada_por IS NULL THEN
    v_pendencias := v_pendencias || jsonb_build_object('tipo','aprovacao','label','Aprovação do responsável pendente');
  END IF;

  RETURN jsonb_build_object('pode', jsonb_array_length(v_pendencias) = 0, 'pendencias', v_pendencias);
END; $function$;

CREATE OR REPLACE FUNCTION public.criar_tarefa_espelho(
  p_instancia_id uuid, p_etapa_id uuid, p_projeto_tarefa_id uuid, p_exige_documentos boolean DEFAULT true
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid; v_t record;
BEGIN
  SELECT id, secao_id, projeto_id INTO v_t FROM projeto_tarefas WHERE id = p_projeto_tarefa_id;
  IF v_t IS NULL THEN RAISE EXCEPTION 'Tarefa não encontrada'; END IF;
  INSERT INTO processo_tarefa_espelho (instancia_id, etapa_id, projeto_tarefa_id, projeto_secao_id, projeto_id, exige_documentos, created_by)
  VALUES (p_instancia_id, p_etapa_id, p_projeto_tarefa_id, v_t.secao_id, v_t.projeto_id, p_exige_documentos, auth.uid())
  ON CONFLICT (instancia_id, etapa_id, projeto_tarefa_id) DO UPDATE SET exige_documentos = EXCLUDED.exige_documentos
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
