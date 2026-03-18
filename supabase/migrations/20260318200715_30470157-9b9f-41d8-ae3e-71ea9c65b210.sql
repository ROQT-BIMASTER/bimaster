
-- =============================================
-- PROCESSO UNIFICADO DO PRODUTO
-- =============================================

-- 1. Tabela principal: product_process
CREATE TABLE public.product_process (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_tipo text NOT NULL CHECK (produto_tipo IN ('china', 'brasil', 'fabrica')),
  produto_ref_id uuid NOT NULL,
  numero_processo text GENERATED ALWAYS AS (
    UPPER(LEFT(produto_tipo, 1)) || '-' || SUBSTRING(id::text, 1, 8)
  ) STORED,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'aprovado', 'reprovado', 'cancelado')),
  etapa_atual text DEFAULT 'ideia',
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_tipo, produto_ref_id)
);

ALTER TABLE public.product_process ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage product_process"
ON public.product_process FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_product_process_ref ON public.product_process(produto_tipo, produto_ref_id);
CREATE INDEX idx_product_process_status ON public.product_process(status);

-- 2. Tabela de eventos: process_events
CREATE TABLE public.process_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid REFERENCES public.product_process(id) ON DELETE CASCADE NOT NULL,
  tipo_evento text NOT NULL,
  descricao text,
  modulo_origem text NOT NULL DEFAULT 'sistema',
  usuario_id uuid,
  usuario_nome text,
  metadata jsonb DEFAULT '{}',
  ref_entity_id uuid,
  ref_entity_table text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.process_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage process_events"
ON public.process_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_process_events_process ON public.process_events(process_id);
CREATE INDEX idx_process_events_created ON public.process_events(created_at DESC);
CREATE INDEX idx_process_events_tipo ON public.process_events(tipo_evento);
CREATE INDEX idx_process_events_modulo ON public.process_events(modulo_origem);

-- 3. Tabela de histórico de etapas: process_step_history
CREATE TABLE public.process_step_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid REFERENCES public.product_process(id) ON DELETE CASCADE NOT NULL,
  etapa text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'pulado')),
  responsavel_id uuid,
  data_inicio timestamptz,
  data_fim timestamptz,
  tempo_permanencia_minutos integer GENERATED ALWAYS AS (
    CASE WHEN data_inicio IS NOT NULL AND data_fim IS NOT NULL
      THEN EXTRACT(EPOCH FROM (data_fim - data_inicio))::integer / 60
      ELSE NULL
    END
  ) STORED,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.process_step_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage process_step_history"
ON public.process_step_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_process_step_history_process ON public.process_step_history(process_id);
CREATE INDEX idx_process_step_history_etapa ON public.process_step_history(etapa);

-- 4. View unificada: vw_process_timeline
CREATE OR REPLACE VIEW public.vw_process_timeline AS

-- Fábrica
SELECT
  h.id,
  'fabrica' AS modulo_origem,
  h.produto_id AS entity_id,
  h.acao AS tipo_evento,
  COALESCE(
    CASE WHEN h.acao = 'INSERT' THEN 'Produto cadastrado na fábrica'
         WHEN h.acao = 'UPDATE' THEN 'Produto atualizado na fábrica'
         ELSE h.acao
    END
  ) AS descricao,
  h.usuario_id,
  NULL::text AS usuario_nome,
  COALESCE(h.campos_alterados, '{}')::jsonb AS metadata,
  h.created_at
FROM public.fabrica_produtos_historico h

UNION ALL

-- Brasil
SELECT
  h.id,
  'brasil' AS modulo_origem,
  h.produto_brasil_id AS entity_id,
  h.tipo AS tipo_evento,
  COALESCE(h.descricao, h.tipo) AS descricao,
  h.user_id AS usuario_id,
  NULL::text AS usuario_nome,
  COALESCE(h.metadata, '{}')::jsonb AS metadata,
  h.created_at
FROM public.produto_brasil_historico h

UNION ALL

-- Documentos
SELECT
  h.id,
  'documentos' AS modulo_origem,
  COALESCE(h.produto_id, h.projeto_id) AS entity_id,
  h.acao AS tipo_evento,
  h.acao AS descricao,
  h.user_id AS usuario_id,
  h.user_name AS usuario_nome,
  COALESCE(h.detalhes, '{}')::jsonb AS metadata,
  h.created_at
FROM public.produto_doc_audit_log h

UNION ALL

-- Fluxo de aprovação
SELECT
  t.id,
  'aprovacao' AS modulo_origem,
  t.instancia_id AS entity_id,
  t.acao AS tipo_evento,
  COALESCE(t.etapa_nome, '') || ' - ' || t.acao AS descricao,
  t.usuario_id,
  NULL::text AS usuario_nome,
  jsonb_build_object('etapa_nome', t.etapa_nome, 'observacao', t.observacao, 'rodada', t.rodada) AS metadata,
  t.created_at
FROM public.fluxo_aprovacao_transicoes t;

-- 5. Trigger para auto-criar processo quando produto é criado em cada módulo

-- Função auxiliar
CREATE OR REPLACE FUNCTION public.fn_auto_create_process()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.product_process (produto_tipo, produto_ref_id, criado_por, etapa_atual)
  VALUES (TG_ARGV[0], NEW.id, COALESCE(NEW.created_by, auth.uid()), 'ideia')
  ON CONFLICT (produto_tipo, produto_ref_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger para china_produto_submissoes
CREATE TRIGGER trg_auto_process_china
AFTER INSERT ON public.china_produto_submissoes
FOR EACH ROW EXECUTE FUNCTION public.fn_auto_create_process('china');

-- 6. Trigger para replicar eventos de historicos existentes para process_events

CREATE OR REPLACE FUNCTION public.fn_replicate_to_process_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_process_id uuid;
  v_tipo text;
  v_ref_id uuid;
  v_modulo text;
  v_descricao text;
  v_metadata jsonb;
BEGIN
  -- Determine source
  IF TG_TABLE_NAME = 'fabrica_produtos_historico' THEN
    v_tipo := 'fabrica';
    v_ref_id := NEW.produto_id;
    v_modulo := 'fabrica';
    v_descricao := CASE WHEN NEW.acao = 'INSERT' THEN 'Produto cadastrado' ELSE 'Produto atualizado' END;
    v_metadata := COALESCE(NEW.campos_alterados, '{}')::jsonb;
  ELSIF TG_TABLE_NAME = 'produto_brasil_historico' THEN
    v_tipo := 'brasil';
    v_ref_id := NEW.produto_brasil_id;
    v_modulo := 'brasil';
    v_descricao := COALESCE(NEW.descricao, NEW.tipo);
    v_metadata := COALESCE(NEW.metadata, '{}')::jsonb;
  END IF;

  -- Find or skip process
  SELECT id INTO v_process_id
  FROM public.product_process
  WHERE produto_tipo = v_tipo AND produto_ref_id = v_ref_id;

  IF v_process_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.process_events (process_id, tipo_evento, descricao, modulo_origem, usuario_id, metadata, ref_entity_id, ref_entity_table)
  VALUES (
    v_process_id,
    COALESCE(NEW.acao, CASE WHEN TG_TABLE_NAME = 'produto_brasil_historico' THEN NEW.tipo ELSE 'evento' END),
    v_descricao,
    v_modulo,
    COALESCE(
      CASE WHEN TG_TABLE_NAME = 'fabrica_produtos_historico' THEN NEW.usuario_id
           WHEN TG_TABLE_NAME = 'produto_brasil_historico' THEN NEW.user_id
      END,
      NULL
    ),
    v_metadata,
    NEW.id,
    TG_TABLE_NAME
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_replicate_fabrica_historico
AFTER INSERT ON public.fabrica_produtos_historico
FOR EACH ROW EXECUTE FUNCTION public.fn_replicate_to_process_events();

CREATE TRIGGER trg_replicate_brasil_historico
AFTER INSERT ON public.produto_brasil_historico
FOR EACH ROW EXECUTE FUNCTION public.fn_replicate_to_process_events();

-- 7. Function to update updated_at
CREATE OR REPLACE FUNCTION public.fn_product_process_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_process_updated_at
BEFORE UPDATE ON public.product_process
FOR EACH ROW EXECUTE FUNCTION public.fn_product_process_updated_at();
