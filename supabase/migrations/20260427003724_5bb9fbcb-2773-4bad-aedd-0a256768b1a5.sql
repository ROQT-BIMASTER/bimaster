-- =====================================================
-- PERFIS DE PROCESSO UNIVERSAIS
-- =====================================================

-- 1. Tabela de perfis (templates)
CREATE TABLE public.processo_perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ambiente text NOT NULL CHECK (ambiente IN ('china', 'brasil', 'fabrica', 'projeto', 'tarefa', 'universal')),
  ativo boolean NOT NULL DEFAULT true,
  padrao boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_processo_perfis_ambiente ON public.processo_perfis(ambiente) WHERE ativo = true;

-- 2. Etapas do perfil
CREATE TABLE public.processo_perfil_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.processo_perfis(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  label text NOT NULL,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  requer_aprovacao boolean NOT NULL DEFAULT false,
  departamento_responsavel_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  cor text DEFAULT '#3B82F6',
  prazo_padrao_dias integer DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, codigo)
);
CREATE INDEX idx_perfil_etapas_perfil ON public.processo_perfil_etapas(perfil_id, ordem);

-- 3. Módulos vinculados à etapa
CREATE TABLE public.processo_etapa_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid NOT NULL REFERENCES public.processo_perfil_etapas(id) ON DELETE CASCADE,
  modulo_codigo text NOT NULL,
  label text,
  rota text,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_etapa_modulos_etapa ON public.processo_etapa_modulos(etapa_id);

-- 4. Documentos obrigatórios da etapa
CREATE TABLE public.processo_etapa_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid NOT NULL REFERENCES public.processo_perfil_etapas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  label text NOT NULL,
  descricao text,
  obrigatorio boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_etapa_docs_etapa ON public.processo_etapa_documentos(etapa_id);

-- 5. Tarefas-template geradas automaticamente
CREATE TABLE public.processo_etapa_tarefas_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etapa_id uuid NOT NULL REFERENCES public.processo_perfil_etapas(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  prazo_dias integer DEFAULT 3,
  responsavel_role text,
  departamento_id uuid REFERENCES public.departamentos(id) ON DELETE SET NULL,
  prioridade text DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_etapa_tarefas_etapa ON public.processo_etapa_tarefas_template(etapa_id);

-- 6. Regras de aplicação automática
CREATE TABLE public.processo_perfil_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.processo_perfis(id) ON DELETE CASCADE,
  ambiente text NOT NULL,
  condicoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  prioridade integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_perfil_regras_ambiente ON public.processo_perfil_regras(ambiente, prioridade) WHERE ativo = true;

-- 7. Instâncias (perfil aplicado a uma entidade)
CREATE TABLE public.processo_instancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id uuid NOT NULL REFERENCES public.processo_perfis(id),
  entidade_tipo text NOT NULL CHECK (entidade_tipo IN ('projeto', 'produto', 'china_submissao', 'tarefa', 'fabrica_ficha')),
  entidade_id uuid NOT NULL,
  etapa_atual_id uuid REFERENCES public.processo_perfil_etapas(id),
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'pausado', 'concluido', 'cancelado')),
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_conclusao timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entidade_tipo, entidade_id)
);
CREATE INDEX idx_instancias_entidade ON public.processo_instancias(entidade_tipo, entidade_id);
CREATE INDEX idx_instancias_etapa_atual ON public.processo_instancias(etapa_atual_id) WHERE status = 'em_andamento';

-- 8. Status de cada etapa por instância
CREATE TABLE public.processo_instancia_etapa_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instancia_id uuid NOT NULL REFERENCES public.processo_instancias(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.processo_perfil_etapas(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'aguardando_aprovacao', 'concluida', 'bloqueada')),
  data_inicio timestamptz,
  data_conclusao timestamptz,
  aprovada_por uuid REFERENCES auth.users(id),
  aprovada_em timestamptz,
  observacoes text,
  checklist_status jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instancia_id, etapa_id)
);
CREATE INDEX idx_instancia_etapa_status ON public.processo_instancia_etapa_status(instancia_id, status);

-- =====================================================
-- TRIGGERS DE updated_at
-- =====================================================
CREATE TRIGGER trg_processo_perfis_updated BEFORE UPDATE ON public.processo_perfis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_processo_perfil_etapas_updated BEFORE UPDATE ON public.processo_perfil_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_processo_instancias_updated BEFORE UPDATE ON public.processo_instancias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_processo_instancia_etapa_status_updated BEFORE UPDATE ON public.processo_instancia_etapa_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- FUNÇÃO: validar avanço de etapa
-- =====================================================
CREATE OR REPLACE FUNCTION public.pode_avancar_etapa(p_instancia_id uuid, p_etapa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pendencias jsonb := '[]'::jsonb;
  v_etapa record;
  v_status record;
  v_doc record;
  v_checklist jsonb;
  v_total_tarefas int;
  v_tarefas_concluidas int;
BEGIN
  SELECT * INTO v_etapa FROM processo_perfil_etapas WHERE id = p_etapa_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('pode', false, 'pendencias', jsonb_build_array(jsonb_build_object('tipo', 'erro', 'label', 'Etapa não encontrada')));
  END IF;

  SELECT * INTO v_status FROM processo_instancia_etapa_status WHERE instancia_id = p_instancia_id AND etapa_id = p_etapa_id;
  v_checklist := COALESCE(v_status.checklist_status, '{}'::jsonb);

  -- Documentos obrigatórios
  FOR v_doc IN SELECT * FROM processo_etapa_documentos WHERE etapa_id = p_etapa_id AND obrigatorio = true LOOP
    IF NOT (COALESCE((v_checklist->'documentos'->v_doc.tipo)::text, 'false') = 'true') THEN
      v_pendencias := v_pendencias || jsonb_build_object('tipo', 'documento', 'label', v_doc.label, 'codigo', v_doc.tipo);
    END IF;
  END LOOP;

  -- Tarefas-template (todas precisam estar concluídas)
  SELECT COUNT(*) INTO v_total_tarefas FROM processo_etapa_tarefas_template WHERE etapa_id = p_etapa_id;
  v_tarefas_concluidas := COALESCE(jsonb_array_length(v_checklist->'tarefas_concluidas'), 0);
  IF v_total_tarefas > 0 AND v_tarefas_concluidas < v_total_tarefas THEN
    v_pendencias := v_pendencias || jsonb_build_object(
      'tipo', 'tarefa',
      'label', format('Tarefas pendentes (%s/%s concluídas)', v_tarefas_concluidas, v_total_tarefas)
    );
  END IF;

  -- Aprovação
  IF v_etapa.requer_aprovacao AND v_status.aprovada_por IS NULL THEN
    v_pendencias := v_pendencias || jsonb_build_object('tipo', 'aprovacao', 'label', 'Aprovação do responsável pendente');
  END IF;

  RETURN jsonb_build_object(
    'pode', jsonb_array_length(v_pendencias) = 0,
    'pendencias', v_pendencias
  );
END;
$$;

-- =====================================================
-- FUNÇÃO: aplicar perfil a uma entidade
-- Cria a instância e gera os status iniciais para todas as etapas
-- =====================================================
CREATE OR REPLACE FUNCTION public.aplicar_perfil_processo(
  p_perfil_id uuid,
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_created_by uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instancia_id uuid;
  v_primeira_etapa_id uuid;
  v_etapa record;
BEGIN
  -- Cria a instância
  INSERT INTO processo_instancias (perfil_id, entidade_tipo, entidade_id, created_by)
  VALUES (p_perfil_id, p_entidade_tipo, p_entidade_id, p_created_by)
  RETURNING id INTO v_instancia_id;

  -- Cria status para cada etapa
  FOR v_etapa IN
    SELECT id, ordem FROM processo_perfil_etapas WHERE perfil_id = p_perfil_id ORDER BY ordem
  LOOP
    INSERT INTO processo_instancia_etapa_status (instancia_id, etapa_id, status)
    VALUES (v_instancia_id, v_etapa.id, CASE WHEN v_etapa.ordem = 0 THEN 'em_andamento' ELSE 'pendente' END);

    IF v_primeira_etapa_id IS NULL THEN
      v_primeira_etapa_id := v_etapa.id;
    END IF;
  END LOOP;

  -- Define etapa atual
  UPDATE processo_instancias SET etapa_atual_id = v_primeira_etapa_id WHERE id = v_instancia_id;

  RETURN v_instancia_id;
END;
$$;

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.processo_perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_perfil_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_etapa_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_etapa_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_etapa_tarefas_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_perfil_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_instancia_etapa_status ENABLE ROW LEVEL SECURITY;

-- Helpers de admin/gerente já existem (has_role)
-- Leitura aberta para autenticados
CREATE POLICY "Autenticados leem perfis" ON public.processo_perfis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados leem etapas" ON public.processo_perfil_etapas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados leem modulos" ON public.processo_etapa_modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados leem documentos" ON public.processo_etapa_documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados leem tarefas template" ON public.processo_etapa_tarefas_template FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados leem regras" ON public.processo_perfil_regras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados leem instancias" ON public.processo_instancias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados leem etapa status" ON public.processo_instancia_etapa_status FOR SELECT TO authenticated USING (true);

-- Escrita: Admin e Gerente
CREATE POLICY "Admin/Gerente gerenciam perfis" ON public.processo_perfis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));
CREATE POLICY "Admin/Gerente gerenciam etapas" ON public.processo_perfil_etapas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));
CREATE POLICY "Admin/Gerente gerenciam modulos" ON public.processo_etapa_modulos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));
CREATE POLICY "Admin/Gerente gerenciam documentos" ON public.processo_etapa_documentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));
CREATE POLICY "Admin/Gerente gerenciam tarefas template" ON public.processo_etapa_tarefas_template FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));
CREATE POLICY "Admin/Gerente gerenciam regras" ON public.processo_perfil_regras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gerente'));

-- Instâncias e status: Admin/Gerente + criador da instância
CREATE POLICY "Admin/Gerente/Criador gerenciam instancias" ON public.processo_instancias FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR created_by = auth.uid()
  );

CREATE POLICY "Admin/Gerente atualizam etapa status" ON public.processo_instancia_etapa_status FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR EXISTS (SELECT 1 FROM public.processo_instancias i WHERE i.id = instancia_id AND i.created_by = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gerente')
    OR EXISTS (SELECT 1 FROM public.processo_instancias i WHERE i.id = instancia_id AND i.created_by = auth.uid())
  );