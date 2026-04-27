-- ============================================================
-- Tabela de referências de Projeto/Seção/Tarefa por etapa do perfil
-- ============================================================
CREATE TABLE IF NOT EXISTS public.processo_etapa_projeto_refs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id        uuid NOT NULL REFERENCES public.processo_perfil_etapas(id) ON DELETE CASCADE,
  projeto_id      uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  secao_id        uuid REFERENCES public.projeto_secoes(id) ON DELETE SET NULL,
  tarefa_id       uuid REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL,
  bloqueia_avanco boolean NOT NULL DEFAULT false,
  observacoes     text,
  ordem           integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid
);

CREATE INDEX IF NOT EXISTS idx_etapa_projeto_refs_etapa
  ON public.processo_etapa_projeto_refs(etapa_id);

CREATE INDEX IF NOT EXISTS idx_etapa_projeto_refs_projeto
  ON public.processo_etapa_projeto_refs(projeto_id);

ALTER TABLE public.processo_etapa_projeto_refs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem etapa_projeto_refs"
  ON public.processo_etapa_projeto_refs;
CREATE POLICY "Autenticados leem etapa_projeto_refs"
  ON public.processo_etapa_projeto_refs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin/Gerente gerenciam etapa_projeto_refs"
  ON public.processo_etapa_projeto_refs;
CREATE POLICY "Admin/Gerente gerenciam etapa_projeto_refs"
  ON public.processo_etapa_projeto_refs FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  );

-- ============================================================
-- aplicar_perfil_processo: criar vínculos em modulo_projeto_vinculos
-- ============================================================
CREATE OR REPLACE FUNCTION public.aplicar_perfil_processo(
  p_perfil_id uuid,
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_instancia_id uuid;
  v_primeira_etapa_id uuid;
  v_etapa record;
  v_mod record;
  v_ref record;
  v_modulo_codigo text;
BEGIN
  INSERT INTO processo_instancias (perfil_id, entidade_tipo, entidade_id, created_by)
  VALUES (p_perfil_id, p_entidade_tipo, p_entidade_id, p_created_by)
  RETURNING id INTO v_instancia_id;

  -- Define o "modulo" base usado em modulo_projeto_vinculos a partir do tipo da entidade
  v_modulo_codigo := CASE
    WHEN p_entidade_tipo = 'produto' THEN 'produto_brasil'
    WHEN p_entidade_tipo = 'china_submissao' THEN 'china_submissao'
    WHEN p_entidade_tipo = 'fabrica_ficha' THEN 'fabrica_ficha'
    WHEN p_entidade_tipo = 'projeto' THEN 'projeto'
    WHEN p_entidade_tipo = 'tarefa' THEN 'tarefa'
    ELSE p_entidade_tipo
  END;

  FOR v_etapa IN
    SELECT id, ordem FROM processo_perfil_etapas
    WHERE perfil_id = p_perfil_id ORDER BY ordem
  LOOP
    INSERT INTO processo_instancia_etapa_status (instancia_id, etapa_id, status)
    VALUES (
      v_instancia_id, v_etapa.id,
      CASE WHEN v_etapa.ordem = 0 THEN 'em_andamento' ELSE 'pendente' END
    );

    IF v_primeira_etapa_id IS NULL THEN
      v_primeira_etapa_id := v_etapa.id;
    END IF;

    -- Vínculos com módulos do catálogo (existente)
    FOR v_mod IN
      SELECT modulo_codigo FROM processo_etapa_modulos WHERE etapa_id = v_etapa.id
    LOOP
      INSERT INTO modulo_processo_link (modulo_codigo, registro_id, instancia_id, etapa_id, status, created_by)
      VALUES (
        v_mod.modulo_codigo, p_entidade_id, v_instancia_id, v_etapa.id,
        CASE WHEN v_etapa.ordem = 0 THEN 'em_andamento' ELSE 'pendente' END,
        p_created_by
      )
      ON CONFLICT (modulo_codigo, registro_id, etapa_id) DO NOTHING;
    END LOOP;

    -- NOVO: vínculos declarados no template para Projeto/Seção/Tarefa existentes
    FOR v_ref IN
      SELECT projeto_id, secao_id, tarefa_id
      FROM processo_etapa_projeto_refs
      WHERE etapa_id = v_etapa.id
    LOOP
      INSERT INTO modulo_projeto_vinculos
        (modulo, registro_id, projeto_id, secao_id, tarefa_id, created_by)
      VALUES
        (v_modulo_codigo, p_entidade_id, v_ref.projeto_id, v_ref.secao_id, v_ref.tarefa_id, p_created_by)
      ON CONFLICT (modulo, registro_id, tarefa_id) DO NOTHING;
    END LOOP;
  END LOOP;

  UPDATE processo_instancias SET etapa_atual_id = v_primeira_etapa_id WHERE id = v_instancia_id;

  IF v_primeira_etapa_id IS NOT NULL THEN
    PERFORM public.gerar_tarefas_etapa(v_instancia_id, v_primeira_etapa_id);
  END IF;

  RETURN v_instancia_id;
END;
$function$;

-- ============================================================
-- pode_avancar_etapa: incluir pendências de processo_etapa_projeto_refs
-- ============================================================
CREATE OR REPLACE FUNCTION public.pode_avancar_etapa(
  p_instancia_id uuid,
  p_etapa_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pendencias jsonb := '[]'::jsonb;
  v_etapa record;
  v_status record;
  v_doc record;
  v_mod record;
  v_link_status text;
  v_checklist jsonb;
  v_total_tarefas int;
  v_tarefas_concluidas int;
  v_ref record;
  v_t_status text;
  v_t_titulo text;
  v_s_nome text;
  v_p_status text;
  v_p_nome text;
  v_total_secao int;
  v_concluidas_secao int;
BEGIN
  SELECT * INTO v_etapa FROM processo_perfil_etapas WHERE id = p_etapa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'pode', false,
      'pendencias', jsonb_build_array(jsonb_build_object('tipo','erro','label','Etapa não encontrada'))
    );
  END IF;

  SELECT * INTO v_status FROM processo_instancia_etapa_status
   WHERE instancia_id = p_instancia_id AND etapa_id = p_etapa_id;
  v_checklist := COALESCE(v_status.checklist_status, '{}'::jsonb);

  -- Documentos obrigatórios
  FOR v_doc IN
    SELECT * FROM processo_etapa_documentos
    WHERE etapa_id = p_etapa_id AND obrigatorio = true
  LOOP
    IF NOT (COALESCE((v_checklist->'documentos'->v_doc.tipo)::text,'false') = 'true') THEN
      v_pendencias := v_pendencias || jsonb_build_object(
        'tipo','documento','label',v_doc.label,'codigo',v_doc.tipo
      );
    END IF;
  END LOOP;

  -- Tarefas template (checklist interno)
  SELECT COUNT(*) INTO v_total_tarefas
    FROM processo_etapa_tarefas_template WHERE etapa_id = p_etapa_id;
  v_tarefas_concluidas := COALESCE(jsonb_array_length(v_checklist->'tarefas_concluidas'),0);
  IF v_total_tarefas > 0 AND v_tarefas_concluidas < v_total_tarefas THEN
    v_pendencias := v_pendencias || jsonb_build_object(
      'tipo','tarefa',
      'label', format('Tarefas pendentes (%s/%s concluídas)', v_tarefas_concluidas, v_total_tarefas)
    );
  END IF;

  -- Módulos bloqueantes
  FOR v_mod IN
    SELECT pem.*, pmc.label AS catalogo_label
      FROM processo_etapa_modulos pem
      LEFT JOIN processo_modulo_catalogo pmc ON pmc.codigo = pem.modulo_codigo
     WHERE pem.etapa_id = p_etapa_id AND pem.bloqueia_avanco = true
  LOOP
    SELECT status INTO v_link_status
      FROM modulo_processo_link
     WHERE instancia_id = p_instancia_id
       AND etapa_id = p_etapa_id
       AND modulo_codigo = v_mod.modulo_codigo
     ORDER BY updated_at DESC LIMIT 1;

    IF v_link_status IS NULL OR v_link_status <> 'concluido' THEN
      v_pendencias := v_pendencias || jsonb_build_object(
        'tipo','modulo',
        'label', format('Módulo %s não concluído',
          COALESCE(v_mod.label, v_mod.catalogo_label, v_mod.modulo_codigo)),
        'codigo', v_mod.modulo_codigo
      );
    END IF;
  END LOOP;

  -- NOVO: refs de Projeto/Seção/Tarefa bloqueantes
  FOR v_ref IN
    SELECT * FROM processo_etapa_projeto_refs
    WHERE etapa_id = p_etapa_id AND bloqueia_avanco = true
  LOOP
    IF v_ref.tarefa_id IS NOT NULL THEN
      SELECT status, titulo INTO v_t_status, v_t_titulo
        FROM projeto_tarefas WHERE id = v_ref.tarefa_id;
      IF v_t_status IS DISTINCT FROM 'concluida' THEN
        v_pendencias := v_pendencias || jsonb_build_object(
          'tipo','projeto_ref',
          'label', format('Tarefa pendente: %s', COALESCE(v_t_titulo,'(removida)'))
        );
      END IF;
    ELSIF v_ref.secao_id IS NOT NULL THEN
      SELECT nome INTO v_s_nome FROM projeto_secoes WHERE id = v_ref.secao_id;
      SELECT COUNT(*) FILTER (WHERE status = 'concluida'),
             COUNT(*)
        INTO v_concluidas_secao, v_total_secao
        FROM projeto_tarefas WHERE secao_id = v_ref.secao_id;
      IF v_total_secao = 0 OR v_concluidas_secao < v_total_secao THEN
        v_pendencias := v_pendencias || jsonb_build_object(
          'tipo','projeto_ref',
          'label', format('Seção pendente: %s (%s/%s)',
            COALESCE(v_s_nome,'(removida)'), v_concluidas_secao, v_total_secao)
        );
      END IF;
    ELSE
      SELECT status, nome INTO v_p_status, v_p_nome
        FROM projetos WHERE id = v_ref.projeto_id;
      IF v_p_status IS DISTINCT FROM 'concluido' AND v_p_status IS DISTINCT FROM 'finalizado' THEN
        v_pendencias := v_pendencias || jsonb_build_object(
          'tipo','projeto_ref',
          'label', format('Projeto não concluído: %s', COALESCE(v_p_nome,'(removido)'))
        );
      END IF;
    END IF;
  END LOOP;

  -- Aprovação
  IF v_etapa.requer_aprovacao AND v_status.aprovada_por IS NULL THEN
    v_pendencias := v_pendencias || jsonb_build_object(
      'tipo','aprovacao','label','Aprovação do responsável pendente'
    );
  END IF;

  RETURN jsonb_build_object(
    'pode', jsonb_array_length(v_pendencias) = 0,
    'pendencias', v_pendencias
  );
END;
$function$;