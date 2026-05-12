
-- 1. Colunas de governança em categorias e itens personalizados
ALTER TABLE public.china_checklist_custom_categorias
  ADD COLUMN IF NOT EXISTS peso_percentual numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_dias integer,
  ADD COLUMN IF NOT EXISTS obrigatorio boolean NOT NULL DEFAULT true;

ALTER TABLE public.china_checklist_custom_itens
  ADD COLUMN IF NOT EXISTS peso_percentual numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prazo_dias integer,
  ADD COLUMN IF NOT EXISTS obrigatorio boolean NOT NULL DEFAULT true;

-- 2. Liberação para OC/OP na submissão
ALTER TABLE public.china_produto_submissoes
  ADD COLUMN IF NOT EXISTS liberado_para_oc_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberado_por uuid;

-- 3. Estado por item do checklist
CREATE TABLE IF NOT EXISTS public.china_checklist_item_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id uuid NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  -- Identificação do item: combinação de fluxo + categoria + tipo (default ou custom_id)
  fluxo text NOT NULL CHECK (fluxo IN ('china_envia','brasil_envia','geral')),
  categoria_key text NOT NULL,         -- key default OU id (texto) da categoria custom
  item_key text NOT NULL,              -- tipo_key default OU id (texto) do item custom
  -- Governança (override por submissão)
  peso_percentual numeric(5,2) NOT NULL DEFAULT 0,
  obrigatorio boolean NOT NULL DEFAULT true,
  prazo_data date,
  responsavel_id uuid,
  -- Estado
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_andamento','concluido','waiver')),
  concluido_em timestamptz,
  concluido_por uuid,
  waiver_motivo text,
  waiver_aprovado_por uuid,
  waiver_aprovado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submissao_id, fluxo, categoria_key, item_key)
);

CREATE INDEX IF NOT EXISTS idx_ccie_submissao ON public.china_checklist_item_estado(submissao_id);
CREATE INDEX IF NOT EXISTS idx_ccie_status_prazo ON public.china_checklist_item_estado(status, prazo_data);

ALTER TABLE public.china_checklist_item_estado ENABLE ROW LEVEL SECURITY;

-- Policies: autenticados podem ler/gerenciar estados das submissões que já podem enxergar
CREATE POLICY "ccie_select" ON public.china_checklist_item_estado
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ccie_insert" ON public.china_checklist_item_estado
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.china_produto_submissoes s WHERE s.id = submissao_id)
  );

CREATE POLICY "ccie_update" ON public.china_checklist_item_estado
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.china_produto_submissoes s WHERE s.id = submissao_id)
  );

CREATE POLICY "ccie_delete" ON public.china_checklist_item_estado
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_ccie_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ccie_updated_at ON public.china_checklist_item_estado;
CREATE TRIGGER trg_ccie_updated_at
  BEFORE UPDATE ON public.china_checklist_item_estado
  FOR EACH ROW EXECUTE FUNCTION public.tg_ccie_updated_at();

-- 4. RPC: calcular progresso ponderado
CREATE OR REPLACE FUNCTION public.rpc_china_calcular_progresso(p_submissao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_peso numeric := 0;
  v_peso_concluido numeric := 0;
  v_peso_pendente_obrig numeric := 0;
  v_atrasados integer := 0;
  v_pendentes integer := 0;
  v_total_itens integer := 0;
  v_pode_liberar boolean := false;
  v_liberado_em timestamptz;
BEGIN
  SELECT
    COALESCE(SUM(peso_percentual), 0),
    COALESCE(SUM(CASE WHEN status IN ('concluido','waiver') THEN peso_percentual ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN obrigatorio AND status NOT IN ('concluido','waiver') THEN peso_percentual ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE prazo_data IS NOT NULL AND prazo_data < (now() AT TIME ZONE 'America/Sao_Paulo')::date AND status NOT IN ('concluido','waiver')),
    COUNT(*) FILTER (WHERE status NOT IN ('concluido','waiver')),
    COUNT(*)
  INTO v_total_peso, v_peso_concluido, v_peso_pendente_obrig, v_atrasados, v_pendentes, v_total_itens
  FROM public.china_checklist_item_estado
  WHERE submissao_id = p_submissao_id;

  v_pode_liberar := (v_peso_pendente_obrig = 0) AND (v_total_itens > 0);

  SELECT liberado_para_oc_em INTO v_liberado_em
  FROM public.china_produto_submissoes
  WHERE id = p_submissao_id;

  RETURN jsonb_build_object(
    'total_peso', v_total_peso,
    'peso_concluido', v_peso_concluido,
    'percent_concluido', CASE WHEN v_total_peso > 0 THEN ROUND((v_peso_concluido / v_total_peso) * 100, 2) ELSE 0 END,
    'peso_pendente_obrigatorio', v_peso_pendente_obrig,
    'itens_atrasados', v_atrasados,
    'itens_pendentes', v_pendentes,
    'total_itens', v_total_itens,
    'pode_liberar', v_pode_liberar,
    'liberado_para_oc_em', v_liberado_em
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_calcular_progresso(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_calcular_progresso(uuid) TO authenticated;

-- 5. RPC: concluir item
CREATE OR REPLACE FUNCTION public.rpc_china_concluir_item(p_estado_id uuid)
RETURNS public.china_checklist_item_estado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.china_checklist_item_estado;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  UPDATE public.china_checklist_item_estado
     SET status = 'concluido',
         concluido_em = now(),
         concluido_por = auth.uid()
   WHERE id = p_estado_id
   RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'item not found';
  END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_concluir_item(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_concluir_item(uuid) TO authenticated;

-- 6. RPC: aplicar waiver (dispensa)
CREATE OR REPLACE FUNCTION public.rpc_china_aplicar_waiver(
  p_estado_id uuid,
  p_motivo text
)
RETURNS public.china_checklist_item_estado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.china_checklist_item_estado;
  v_submissao_id uuid;
  v_is_authorized boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'motivo obrigatório (mínimo 5 caracteres)';
  END IF;

  SELECT submissao_id INTO v_submissao_id
  FROM public.china_checklist_item_estado WHERE id = p_estado_id;

  IF v_submissao_id IS NULL THEN
    RAISE EXCEPTION 'item not found';
  END IF;

  -- Autorizado: admin, supervisor OU gestor (created_by da submissão)
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'supervisor'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.china_produto_submissoes
      WHERE id = v_submissao_id AND created_by = auth.uid()
    )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'não autorizado a aplicar dispensa';
  END IF;

  UPDATE public.china_checklist_item_estado
     SET status = 'waiver',
         waiver_motivo = p_motivo,
         waiver_aprovado_por = auth.uid(),
         waiver_aprovado_em = now()
   WHERE id = p_estado_id
   RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_aplicar_waiver(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_aplicar_waiver(uuid, text) TO authenticated;

-- 7. RPC: liberar para OC/OP
CREATE OR REPLACE FUNCTION public.rpc_china_liberar_para_oc(p_submissao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_progresso jsonb;
  v_pode boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  v_progresso := public.rpc_china_calcular_progresso(p_submissao_id);
  v_pode := (v_progresso->>'pode_liberar')::boolean;

  IF NOT v_pode THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'checklist incompleto',
      'progresso', v_progresso
    );
  END IF;

  UPDATE public.china_produto_submissoes
     SET liberado_para_oc_em = now(),
         liberado_por = auth.uid()
   WHERE id = p_submissao_id;

  RETURN jsonb_build_object('ok', true, 'progresso', v_progresso);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_liberar_para_oc(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_liberar_para_oc(uuid) TO authenticated;
