-- =====================================================
-- 1. Validação estrutural: FK do módulo no catálogo
-- =====================================================

-- Backfill: garante que todo modulo_codigo existente esteja no catálogo
INSERT INTO public.processo_modulo_catalogo (codigo, label, rota, entidade_alvo, ativo, ordem)
SELECT DISTINCT pem.modulo_codigo,
                COALESCE(pem.label, pem.modulo_codigo),
                COALESCE(pem.rota, '/'),
                'produto',
                true,
                999
FROM public.processo_etapa_modulos pem
LEFT JOIN public.processo_modulo_catalogo c ON c.codigo = pem.modulo_codigo
WHERE c.codigo IS NULL
ON CONFLICT (codigo) DO NOTHING;

-- Adiciona FK só se ainda não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'processo_etapa_modulos_modulo_codigo_fkey'
  ) THEN
    ALTER TABLE public.processo_etapa_modulos
      ADD CONSTRAINT processo_etapa_modulos_modulo_codigo_fkey
      FOREIGN KEY (modulo_codigo)
      REFERENCES public.processo_modulo_catalogo(codigo)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

-- =====================================================
-- 2. Templates de tarefas: amarrar ao módulo + subtarefas
-- =====================================================
ALTER TABLE public.processo_etapa_tarefas_template
  ADD COLUMN IF NOT EXISTS modulo_codigo text REFERENCES public.processo_modulo_catalogo(codigo) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtarefas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_gerar boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_etapa_tarefas_modulo
  ON public.processo_etapa_tarefas_template (modulo_codigo);

-- =====================================================
-- 3. Rastro de geração (idempotência)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.processo_instancia_tarefa_gerada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.processo_instancias(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.processo_perfil_etapas(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.processo_etapa_tarefas_template(id) ON DELETE CASCADE,
  tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL,
  modulo_codigo text REFERENCES public.processo_modulo_catalogo(codigo) ON DELETE SET NULL,
  parent_tarefa_id uuid REFERENCES public.projeto_tarefas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, etapa_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_pitg_instancia ON public.processo_instancia_tarefa_gerada (instancia_id);
CREATE INDEX IF NOT EXISTS idx_pitg_etapa ON public.processo_instancia_tarefa_gerada (etapa_id);

ALTER TABLE public.processo_instancia_tarefa_gerada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pitg_select_auth" ON public.processo_instancia_tarefa_gerada;
CREATE POLICY "pitg_select_auth" ON public.processo_instancia_tarefa_gerada
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pitg_insert_auth" ON public.processo_instancia_tarefa_gerada;
CREATE POLICY "pitg_insert_auth" ON public.processo_instancia_tarefa_gerada
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "pitg_delete_admin" ON public.processo_instancia_tarefa_gerada;
CREATE POLICY "pitg_delete_admin" ON public.processo_instancia_tarefa_gerada
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- 4. Função: resolver projeto associado à instância
-- =====================================================
CREATE OR REPLACE FUNCTION public.resolver_projeto_da_instancia(p_instancia_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst record;
  v_projeto_id uuid;
BEGIN
  SELECT entidade_tipo, entidade_id INTO v_inst
  FROM processo_instancias WHERE id = p_instancia_id;

  IF v_inst IS NULL THEN RETURN NULL; END IF;

  IF v_inst.entidade_tipo = 'projeto' THEN
    RETURN v_inst.entidade_id;
  END IF;

  -- Para produto/produto_china, tenta achar um projeto vinculado
  SELECT projeto_id INTO v_projeto_id
  FROM modulo_projeto_vinculos
  WHERE produto_id = v_inst.entidade_id
  LIMIT 1;

  RETURN v_projeto_id;
END;
$$;

-- =====================================================
-- 5. Função principal: gerar tarefas e subtarefas da etapa
-- =====================================================
CREATE OR REPLACE FUNCTION public.gerar_tarefas_etapa(
  p_instancia_id uuid,
  p_etapa_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_projeto_id uuid;
  v_secao_id uuid;
  v_tpl record;
  v_sub jsonb;
  v_tarefa_id uuid;
  v_sub_id uuid;
  v_count_tarefas int := 0;
  v_count_subs int := 0;
  v_etapa record;
  v_inst record;
  v_prazo date;
  v_existing uuid;
BEGIN
  SELECT * INTO v_etapa FROM processo_perfil_etapas WHERE id = p_etapa_id;
  SELECT * INTO v_inst FROM processo_instancias WHERE id = p_instancia_id;

  IF v_etapa IS NULL OR v_inst IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'etapa ou instância inválida');
  END IF;

  v_projeto_id := public.resolver_projeto_da_instancia(p_instancia_id);

  -- Sem projeto associado: registra tentativa sem criar tarefa real
  IF v_projeto_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'tarefas_criadas', 0,
      'subtarefas_criadas', 0,
      'aviso', 'Sem projeto vinculado à entidade — tarefas não geradas'
    );
  END IF;

  -- Pega/cria a primeira seção do projeto
  SELECT id INTO v_secao_id FROM projeto_secoes
  WHERE projeto_id = v_projeto_id ORDER BY ordem ASC LIMIT 1;

  IF v_secao_id IS NULL THEN
    INSERT INTO projeto_secoes (projeto_id, nome, ordem)
    VALUES (v_projeto_id, COALESCE(v_etapa.label, 'Etapa do processo'), 0)
    RETURNING id INTO v_secao_id;
  END IF;

  -- Para cada template da etapa
  FOR v_tpl IN
    SELECT * FROM processo_etapa_tarefas_template
    WHERE etapa_id = p_etapa_id AND auto_gerar = true
    ORDER BY ordem ASC
  LOOP
    -- Idempotência: se já gerou, pula
    SELECT tarefa_id INTO v_existing
    FROM processo_instancia_tarefa_gerada
    WHERE instancia_id = p_instancia_id
      AND etapa_id = p_etapa_id
      AND template_id = v_tpl.id;

    IF v_existing IS NOT NULL THEN CONTINUE; END IF;

    v_prazo := (CURRENT_DATE + COALESCE(v_tpl.prazo_dias, v_etapa.prazo_padrao_dias, 5));

    INSERT INTO projeto_tarefas (
      projeto_id, secao_id, titulo, descricao, status, prioridade,
      data_prazo, criador_id, tipo_tarefa
    )
    VALUES (
      v_projeto_id,
      v_secao_id,
      v_tpl.titulo,
      COALESCE(v_tpl.descricao, '') ||
        E'\n\n[Gerada automaticamente pelo processo • etapa: ' || v_etapa.label || ']',
      'pendente',
      COALESCE(v_tpl.prioridade, 'media'),
      v_prazo,
      v_user,
      'padrao'
    )
    RETURNING id INTO v_tarefa_id;

    INSERT INTO processo_instancia_tarefa_gerada
      (instancia_id, etapa_id, template_id, tarefa_id, modulo_codigo)
    VALUES (p_instancia_id, p_etapa_id, v_tpl.id, v_tarefa_id, v_tpl.modulo_codigo);

    v_count_tarefas := v_count_tarefas + 1;

    -- Subtarefas: jsonb array de strings ou objetos {titulo, prazo_dias?}
    IF v_tpl.subtarefas IS NOT NULL AND jsonb_typeof(v_tpl.subtarefas) = 'array' THEN
      FOR v_sub IN SELECT * FROM jsonb_array_elements(v_tpl.subtarefas)
      LOOP
        INSERT INTO projeto_tarefas (
          projeto_id, secao_id, parent_tarefa_id, titulo, status, prioridade,
          data_prazo, criador_id, tipo_tarefa
        )
        VALUES (
          v_projeto_id,
          v_secao_id,
          v_tarefa_id,
          COALESCE(v_sub->>'titulo', v_sub#>>'{}'),
          'pendente',
          COALESCE(v_sub->>'prioridade', v_tpl.prioridade, 'media'),
          (CURRENT_DATE + COALESCE((v_sub->>'prazo_dias')::int, v_tpl.prazo_dias, 3)),
          v_user,
          'padrao'
        )
        RETURNING id INTO v_sub_id;

        v_count_subs := v_count_subs + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'projeto_id', v_projeto_id,
    'tarefas_criadas', v_count_tarefas,
    'subtarefas_criadas', v_count_subs
  );
END;
$$;

-- =====================================================
-- 6. Atualiza aplicar_perfil_processo: gera tarefas da 1ª etapa
-- =====================================================
CREATE OR REPLACE FUNCTION public.aplicar_perfil_processo(
  p_perfil_id uuid,
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_created_by uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instancia_id uuid;
  v_primeira_etapa_id uuid;
  v_etapa record;
  v_mod record;
BEGIN
  INSERT INTO processo_instancias (perfil_id, entidade_tipo, entidade_id, created_by)
  VALUES (p_perfil_id, p_entidade_tipo, p_entidade_id, p_created_by)
  RETURNING id INTO v_instancia_id;

  FOR v_etapa IN SELECT id, ordem FROM processo_perfil_etapas WHERE perfil_id = p_perfil_id ORDER BY ordem LOOP
    INSERT INTO processo_instancia_etapa_status (instancia_id, etapa_id, status)
    VALUES (v_instancia_id, v_etapa.id, CASE WHEN v_etapa.ordem = 0 THEN 'em_andamento' ELSE 'pendente' END);

    IF v_primeira_etapa_id IS NULL THEN
      v_primeira_etapa_id := v_etapa.id;
    END IF;

    FOR v_mod IN SELECT modulo_codigo FROM processo_etapa_modulos WHERE etapa_id = v_etapa.id LOOP
      INSERT INTO modulo_processo_link (modulo_codigo, registro_id, instancia_id, etapa_id, status, created_by)
      VALUES (
        v_mod.modulo_codigo,
        p_entidade_id,
        v_instancia_id,
        v_etapa.id,
        CASE WHEN v_etapa.ordem = 0 THEN 'em_andamento' ELSE 'pendente' END,
        p_created_by
      )
      ON CONFLICT (modulo_codigo, registro_id, etapa_id) DO NOTHING;
    END LOOP;
  END LOOP;

  UPDATE processo_instancias SET etapa_atual_id = v_primeira_etapa_id WHERE id = v_instancia_id;

  -- Gera tarefas/subtarefas da primeira etapa (em andamento)
  IF v_primeira_etapa_id IS NOT NULL THEN
    PERFORM public.gerar_tarefas_etapa(v_instancia_id, v_primeira_etapa_id);
  END IF;

  RETURN v_instancia_id;
END;
$$;

-- =====================================================
-- 7. Atualiza avancar_etapa_processo: gera tarefas da próxima etapa
-- =====================================================
CREATE OR REPLACE FUNCTION public.avancar_etapa_processo(
  p_instancia_id uuid,
  p_etapa_id uuid,
  p_observacoes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validacao jsonb;
  v_proxima_etapa_id uuid;
  v_ordem_atual int;
  v_perfil_id uuid;
  v_user uuid := auth.uid();
  v_geracao jsonb;
BEGIN
  SELECT public.pode_avancar_etapa(p_instancia_id, p_etapa_id) INTO v_validacao;
  IF NOT (v_validacao->>'pode')::boolean THEN
    RETURN jsonb_build_object('success', false, 'pendencias', v_validacao->'pendencias');
  END IF;

  INSERT INTO public.processo_instancia_etapa_status (instancia_id, etapa_id, status, data_conclusao, aprovada_por, aprovada_em, observacoes)
  VALUES (p_instancia_id, p_etapa_id, 'concluida', now(), v_user, now(), p_observacoes)
  ON CONFLICT (instancia_id, etapa_id) DO UPDATE
    SET status = 'concluida',
        data_conclusao = now(),
        aprovada_por = v_user,
        aprovada_em = now(),
        observacoes = COALESCE(EXCLUDED.observacoes, processo_instancia_etapa_status.observacoes),
        updated_at = now();

  SELECT pe.perfil_id, pe.ordem INTO v_perfil_id, v_ordem_atual
  FROM public.processo_perfil_etapas pe WHERE pe.id = p_etapa_id;

  SELECT id INTO v_proxima_etapa_id
  FROM public.processo_perfil_etapas
  WHERE perfil_id = v_perfil_id AND ordem > v_ordem_atual
  ORDER BY ordem ASC
  LIMIT 1;

  IF v_proxima_etapa_id IS NULL THEN
    UPDATE public.processo_instancias
    SET status = 'concluido', etapa_atual_id = NULL, updated_at = now()
    WHERE id = p_instancia_id;
    RETURN jsonb_build_object('success', true, 'concluido', true);
  END IF;

  UPDATE public.processo_instancias
  SET etapa_atual_id = v_proxima_etapa_id, updated_at = now()
  WHERE id = p_instancia_id;

  INSERT INTO public.processo_instancia_etapa_status (instancia_id, etapa_id, status, data_inicio)
  VALUES (p_instancia_id, v_proxima_etapa_id, 'em_andamento', now())
  ON CONFLICT (instancia_id, etapa_id) DO UPDATE
    SET status = 'em_andamento',
        data_inicio = COALESCE(processo_instancia_etapa_status.data_inicio, now()),
        updated_at = now();

  -- Marca links da próxima etapa como em_andamento
  UPDATE public.modulo_processo_link
  SET status = 'em_andamento', updated_at = now()
  WHERE instancia_id = p_instancia_id
    AND etapa_id = v_proxima_etapa_id
    AND status = 'pendente';

  -- Gera tarefas/subtarefas da nova etapa
  v_geracao := public.gerar_tarefas_etapa(p_instancia_id, v_proxima_etapa_id);

  RETURN jsonb_build_object(
    'success', true,
    'proxima_etapa_id', v_proxima_etapa_id,
    'geracao_tarefas', v_geracao
  );
END;
$$;