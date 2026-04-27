-- =============================================================
-- Catálogo de Módulos + Vínculo Bidirecional Perfil ↔ Módulos
-- =============================================================

-- 1. Catálogo oficial de módulos
CREATE TABLE IF NOT EXISTS public.processo_modulo_catalogo (
  codigo text PRIMARY KEY,
  label text NOT NULL,
  descricao text,
  icone text,
  cor text,
  rota text NOT NULL,
  entidade_alvo text NOT NULL DEFAULT 'produto',
  param_template text,
  cria_registro_automatico boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processo_modulo_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_select_authenticated"
  ON public.processo_modulo_catalogo FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "catalogo_admin_write"
  ON public.processo_modulo_catalogo FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Estender processo_etapa_modulos
ALTER TABLE public.processo_etapa_modulos
  ADD COLUMN IF NOT EXISTS auto_criar_registro boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueia_avanco boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- 3. Vínculo bidirecional módulo ↔ etapa
CREATE TABLE IF NOT EXISTS public.modulo_processo_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_codigo text NOT NULL REFERENCES public.processo_modulo_catalogo(codigo) ON DELETE RESTRICT,
  registro_id uuid NOT NULL,
  instancia_id uuid NOT NULL REFERENCES public.processo_instancias(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.processo_perfil_etapas(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido','cancelado')),
  observacoes text,
  concluido_em timestamptz,
  concluido_por uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modulo_codigo, registro_id, etapa_id)
);

CREATE INDEX IF NOT EXISTS idx_mpl_modulo_registro ON public.modulo_processo_link(modulo_codigo, registro_id);
CREATE INDEX IF NOT EXISTS idx_mpl_instancia ON public.modulo_processo_link(instancia_id);
CREATE INDEX IF NOT EXISTS idx_mpl_etapa ON public.modulo_processo_link(etapa_id);

ALTER TABLE public.modulo_processo_link ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mpl_select_authenticated"
  ON public.modulo_processo_link FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "mpl_insert_authenticated"
  ON public.modulo_processo_link FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "mpl_update_authenticated"
  ON public.modulo_processo_link FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "mpl_delete_admin"
  ON public.modulo_processo_link FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER trg_mpl_updated_at
  BEFORE UPDATE ON public.modulo_processo_link
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_catalogo_updated_at
  BEFORE UPDATE ON public.processo_modulo_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Função: vincular módulo a uma etapa do processo
CREATE OR REPLACE FUNCTION public.vincular_modulo_a_etapa(
  p_modulo_codigo text,
  p_registro_id uuid,
  p_instancia_id uuid,
  p_etapa_id uuid,
  p_status text DEFAULT 'em_andamento'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.modulo_processo_link (modulo_codigo, registro_id, instancia_id, etapa_id, status, created_by)
  VALUES (p_modulo_codigo, p_registro_id, p_instancia_id, p_etapa_id, p_status, auth.uid())
  ON CONFLICT (modulo_codigo, registro_id, etapa_id) DO UPDATE
    SET status = EXCLUDED.status, updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 5. Função: concluir vínculo (pelo módulo)
CREATE OR REPLACE FUNCTION public.concluir_modulo_link(
  p_modulo_codigo text,
  p_registro_id uuid,
  p_etapa_id uuid,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.modulo_processo_link
     SET status = 'concluido',
         concluido_em = now(),
         concluido_por = auth.uid(),
         observacoes = COALESCE(p_observacoes, observacoes),
         updated_at = now()
   WHERE modulo_codigo = p_modulo_codigo
     AND registro_id = p_registro_id
     AND etapa_id = p_etapa_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', v_count > 0, 'updated', v_count);
END;
$$;

-- 6. Atualiza pode_avancar_etapa para considerar módulos bloqueantes
CREATE OR REPLACE FUNCTION public.pode_avancar_etapa(p_instancia_id uuid, p_etapa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
BEGIN
  SELECT * INTO v_etapa FROM processo_perfil_etapas WHERE id = p_etapa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('pode', false, 'pendencias', jsonb_build_array(jsonb_build_object('tipo','erro','label','Etapa não encontrada')));
  END IF;

  SELECT * INTO v_status FROM processo_instancia_etapa_status WHERE instancia_id = p_instancia_id AND etapa_id = p_etapa_id;
  v_checklist := COALESCE(v_status.checklist_status, '{}'::jsonb);

  -- Documentos obrigatórios
  FOR v_doc IN SELECT * FROM processo_etapa_documentos WHERE etapa_id = p_etapa_id AND obrigatorio = true LOOP
    IF NOT (COALESCE((v_checklist->'documentos'->v_doc.tipo)::text,'false') = 'true') THEN
      v_pendencias := v_pendencias || jsonb_build_object('tipo','documento','label',v_doc.label,'codigo',v_doc.tipo);
    END IF;
  END LOOP;

  -- Tarefas
  SELECT COUNT(*) INTO v_total_tarefas FROM processo_etapa_tarefas_template WHERE etapa_id = p_etapa_id;
  v_tarefas_concluidas := COALESCE(jsonb_array_length(v_checklist->'tarefas_concluidas'),0);
  IF v_total_tarefas > 0 AND v_tarefas_concluidas < v_total_tarefas THEN
    v_pendencias := v_pendencias || jsonb_build_object('tipo','tarefa','label',format('Tarefas pendentes (%s/%s concluídas)',v_tarefas_concluidas,v_total_tarefas));
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
        'label', format('Módulo %s não concluído', COALESCE(v_mod.label, v_mod.catalogo_label, v_mod.modulo_codigo)),
        'codigo', v_mod.modulo_codigo
      );
    END IF;
  END LOOP;

  -- Aprovação
  IF v_etapa.requer_aprovacao AND v_status.aprovada_por IS NULL THEN
    v_pendencias := v_pendencias || jsonb_build_object('tipo','aprovacao','label','Aprovação do responsável pendente');
  END IF;

  RETURN jsonb_build_object('pode', jsonb_array_length(v_pendencias) = 0, 'pendencias', v_pendencias);
END;
$$;

-- 7. Atualiza aplicar_perfil_processo para criar links iniciais (status pendente) dos módulos da primeira etapa
CREATE OR REPLACE FUNCTION public.aplicar_perfil_processo(p_perfil_id uuid, p_entidade_tipo text, p_entidade_id uuid, p_created_by uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

    -- Cria links de módulos como pendentes (em_andamento na primeira etapa)
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
  RETURN v_instancia_id;
END;
$$;

-- 8. Seed do catálogo
INSERT INTO public.processo_modulo_catalogo (codigo, label, descricao, icone, cor, rota, entidade_alvo, param_template, ordem) VALUES
  ('composicao', 'Composição INCI', 'Composição química e ingredientes do produto', 'FlaskConical', 'purple', '/dashboard/composicao', 'produto', '?produto={entidade_id}', 10),
  ('amostras', 'Amostras', 'Solicitação e gestão de amostras', 'Package', 'blue', '/dashboard/amostras', 'produto', '?produto={entidade_id}', 20),
  ('analise_embalagem', 'Análise de Embalagem', 'Análise técnica de embalagem', 'Package2', 'cyan', '/dashboard/embalagem', 'produto', '?produto={entidade_id}', 30),
  ('etiqueta_bula', 'Etiqueta / Bula', 'Aprovação de etiqueta e bula regulatória', 'Tag', 'orange', '/dashboard/etiqueta-bula', 'produto', '?produto={entidade_id}', 40),
  ('fluxo_artes', 'Motor de Artes', 'Fluxo criativo de artes e materiais', 'Palette', 'pink', '/dashboard/fluxo-artes', 'produto', '?produto={entidade_id}', 50),
  ('aprovacao_artes', 'Aprovação de Artes', 'Aprovação final das artes', 'CheckCircle2', 'green', '/dashboard/aprovacao-artes', 'produto', '?produto={entidade_id}', 60),
  ('ficha_china', 'Ficha do Produto China', 'Ficha técnica vinda da fábrica chinesa', 'FileText', 'red', '/dashboard/fabrica-china/recebimentos', 'produto_china', '?produto={entidade_id}', 70),
  ('fabrica_china', 'Fábrica China', 'Operações de fábrica China', 'Factory', 'red', '/dashboard/fabrica-china', 'produto_china', '?produto={entidade_id}', 80),
  ('ficha_custos', 'Ficha de Custos', 'Custos de produção do produto', 'Calculator', 'amber', '/dashboard/fabrica/ficha-custos', 'produto', '?produto={entidade_id}', 90),
  ('cofre_documentos', 'Cofre de Documentos', 'Documentos oficiais e regulatórios', 'Archive', 'slate', '/dashboard/cofre-documentos', 'produto', '?produto={entidade_id}', 100),
  ('regulatorio_anvisa', 'Regulatório ANVISA', 'Processo regulatório junto à ANVISA', 'Shield', 'indigo', '/dashboard/regulatorio', 'produto', '?produto={entidade_id}', 110),
  ('content_intelligence', 'Inteligência de Conteúdo', 'Análise de conteúdo de marketing', 'Brain', 'violet', '/dashboard/influenciadores', 'produto', '?produto={entidade_id}', 120)
ON CONFLICT (codigo) DO UPDATE SET
  label = EXCLUDED.label,
  descricao = EXCLUDED.descricao,
  icone = EXCLUDED.icone,
  cor = EXCLUDED.cor,
  rota = EXCLUDED.rota,
  entidade_alvo = EXCLUDED.entidade_alvo,
  param_template = EXCLUDED.param_template,
  ordem = EXCLUDED.ordem,
  updated_at = now();