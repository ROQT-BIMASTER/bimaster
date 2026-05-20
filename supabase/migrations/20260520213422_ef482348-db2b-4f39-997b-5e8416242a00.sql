
-- =====================================================================
-- PR1 — Briefings v2 / Intake (migração única, atômica)
-- =====================================================================

-- 1. briefings: preservar legado, mapear, trocar CHECK, adicionar colunas
ALTER TABLE public.briefings DROP CONSTRAINT IF EXISTS briefings_tipo_check;

ALTER TABLE public.briefings
  ADD COLUMN IF NOT EXISTS tipo_legado text,
  ADD COLUMN IF NOT EXISTS intake_demanda_id uuid,
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS posicao_no_lote smallint,
  ADD COLUMN IF NOT EXISTS total_no_lote smallint,
  ADD COLUMN IF NOT EXISTS completeness_score smallint NOT NULL DEFAULT 0
    CHECK (completeness_score BETWEEN 0 AND 100);

-- Mapeamento da taxonomia v1 → v2 (preserva original em tipo_legado)
UPDATE public.briefings
   SET tipo_legado = tipo,
       tipo = CASE tipo
         WHEN 'criativo'  THEN 'campanha'
         WHEN 'marketing' THEN 'campanha'
         WHEN 'produto'   THEN 'embalagem'
         WHEN 'trade'     THEN 'pdv'
         ELSE tipo
       END
 WHERE tipo IN ('criativo','marketing','produto','trade');

ALTER TABLE public.briefings
  ADD CONSTRAINT briefings_tipo_check
  CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno'));

ALTER TABLE public.briefings
  ADD CONSTRAINT briefings_codigo_unique UNIQUE (codigo);

CREATE INDEX IF NOT EXISTS idx_briefings_intake_demanda_id
  ON public.briefings(intake_demanda_id);

COMMENT ON COLUMN public.briefings.tipo_legado IS
  'Tipo da taxonomia v1 (marketing/criativo/produto/trade). Preservado para histórico após migração para 8 tipos no PR1.';
COMMENT ON COLUMN public.briefings.completeness_score IS
  'Pontuação 0-100 baseada em briefing_campos_obrigatorios. Recalculada por trigger quando payload muda. 0 quando não há obrigatórios cadastrados.';
COMMENT ON COLUMN public.briefings.codigo IS
  'Código legível BRF-AAAA-MM-DD-NNN, gerado por gen_codigo_briefing() com lock advisory diário.';

-- 2. intake_demandas
CREATE TABLE public.intake_demandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  empresa_id integer REFERENCES public.empresas(id),
  solicitante_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno','indefinido')),
  descricao_original text,
  status text NOT NULL DEFAULT 'em_coleta'
    CHECK (status IN ('em_coleta','lote_gerado','cancelada','arquivada')),
  total_briefings smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

COMMENT ON TABLE public.intake_demandas IS
  'Demanda-mãe: 1 conversa com o intake agent gera 1 linha aqui + N briefings filhos via FK briefings.intake_demanda_id.';

CREATE INDEX idx_intake_demandas_solicitante ON public.intake_demandas(solicitante_id);
CREATE INDEX idx_intake_demandas_empresa ON public.intake_demandas(empresa_id);
CREATE INDEX idx_intake_demandas_status ON public.intake_demandas(status);

ALTER TABLE public.briefings
  ADD CONSTRAINT briefings_intake_demanda_fk
  FOREIGN KEY (intake_demanda_id) REFERENCES public.intake_demandas(id) ON DELETE SET NULL;

ALTER TABLE public.intake_demandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake_demandas_admin_all" ON public.intake_demandas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "intake_demandas_solicitante_select" ON public.intake_demandas
  FOR SELECT TO authenticated
  USING (solicitante_id = auth.uid());

CREATE POLICY "intake_demandas_solicitante_insert" ON public.intake_demandas
  FOR INSERT TO authenticated
  WITH CHECK (solicitante_id = auth.uid());

CREATE POLICY "intake_demandas_solicitante_update" ON public.intake_demandas
  FOR UPDATE TO authenticated
  USING (solicitante_id = auth.uid())
  WITH CHECK (solicitante_id = auth.uid());

-- 3. briefing_catalogos_padrao
CREATE TABLE public.briefing_catalogos_padrao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL REFERENCES public.empresas(id),
  marca text,
  tipo text NOT NULL CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno')),
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX briefing_catalogos_padrao_uniq
  ON public.briefing_catalogos_padrao(empresa_id, COALESCE(marca,''), tipo);

COMMENT ON TABLE public.briefing_catalogos_padrao IS
  'Catálogos por (empresa, marca, tipo) com fallback marca → empresa. Acesso via rpc_lookup_catalogo, nunca SELECT direto.';

ALTER TABLE public.briefing_catalogos_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogos_admin_all" ON public.briefing_catalogos_padrao
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "catalogos_auth_select" ON public.briefing_catalogos_padrao
  FOR SELECT TO authenticated USING (true);

-- 4. briefing_defaults
CREATE TABLE public.briefing_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL REFERENCES public.empresas(id),
  tipo text NOT NULL CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno')),
  campo text NOT NULL,
  valor_padrao jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, tipo, campo)
);

COMMENT ON TABLE public.briefing_defaults IS
  'Valores padrão por (empresa, tipo, campo) aplicados quando solicitante não preenche. Populado no PR2.';

ALTER TABLE public.briefing_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "defaults_admin_all" ON public.briefing_defaults
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "defaults_auth_select" ON public.briefing_defaults
  FOR SELECT TO authenticated USING (true);

-- 5. briefing_campos_obrigatorios
CREATE TABLE public.briefing_campos_obrigatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id integer NOT NULL REFERENCES public.empresas(id),
  tipo text NOT NULL CHECK (tipo IN ('pdv','embalagem','evento','campanha','ecommerce','presskit','catalogo','material_interno')),
  campo text NOT NULL,
  peso smallint NOT NULL DEFAULT 1 CHECK (peso BETWEEN 1 AND 10),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, tipo, campo)
);

COMMENT ON TABLE public.briefing_campos_obrigatorios IS
  'Lista de campos obrigatórios por (empresa, tipo). Peso 1-10 alimenta calc_completeness. Peso 10 = crítico (bloqueia Concluir lote no PR4).';
COMMENT ON COLUMN public.briefing_campos_obrigatorios.campo IS
  'Caminho jsonb separado por ponto. Suporta nested objects (dimensoes.largura) e arrays (lista_skus.0.codigo). Use índice numérico como segmento para acessar arrays.';

ALTER TABLE public.briefing_campos_obrigatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obrigatorios_admin_all" ON public.briefing_campos_obrigatorios
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "obrigatorios_auth_select" ON public.briefing_campos_obrigatorios
  FOR SELECT TO authenticated USING (true);

-- 6. briefings_audit
CREATE TABLE public.briefings_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id uuid NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  diff jsonb NOT NULL
);

COMMENT ON TABLE public.briefings_audit IS
  'Histórico de edições do payload. Diff só de chaves alteradas. Retention a definir no PR5+. Sem cron ativo.';

CREATE INDEX idx_briefings_audit_briefing ON public.briefings_audit(briefing_id, changed_at DESC);

ALTER TABLE public.briefings_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_admin_select" ON public.briefings_audit
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. Funções: gen_codigo_intake_demanda / gen_codigo_briefing
CREATE OR REPLACE FUNCTION public.gen_codigo_intake_demanda()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_data text := to_char(current_date, 'YYYY-MM-DD'); v_seq int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('intake_demanda_' || current_date::text));
  SELECT COALESCE(MAX((regexp_match(codigo, 'DEM-\d{4}-\d{2}-\d{2}-(\d+)'))[1]::int), 0) + 1
    INTO v_seq FROM public.intake_demandas WHERE codigo LIKE 'DEM-' || v_data || '-%';
  RETURN 'DEM-' || v_data || '-' || lpad(v_seq::text, 3, '0');
END;$$;

CREATE OR REPLACE FUNCTION public.gen_codigo_briefing()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_data text := to_char(current_date, 'YYYY-MM-DD'); v_seq int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('briefing_' || current_date::text));
  SELECT COALESCE(MAX((regexp_match(codigo, 'BRF-\d{4}-\d{2}-\d{2}-(\d+)'))[1]::int), 0) + 1
    INTO v_seq FROM public.briefings WHERE codigo LIKE 'BRF-' || v_data || '-%';
  RETURN 'BRF-' || v_data || '-' || lpad(v_seq::text, 3, '0');
END;$$;

-- 8. calc_briefing_status
CREATE OR REPLACE FUNCTION public.calc_briefing_status(p_tipo text, p_payload jsonb)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_kv text := p_payload->>'kv_url';
  v_dim jsonb := p_payload->'dimensoes';
  v_faca text := p_payload->>'faca_url';
  v_aprov text := p_payload->>'regulatorio_status';
BEGIN
  IF p_tipo IN ('campanha','ecommerce','pdv','embalagem','presskit') AND (v_kv IS NULL OR v_kv = '') THEN
    RETURN 'Aguardando KV';
  END IF;
  IF p_tipo IN ('pdv','embalagem') AND (v_dim IS NULL OR v_dim = '{}'::jsonb) THEN
    RETURN 'Aguardando Medidas';
  END IF;
  IF p_tipo = 'embalagem' AND (v_faca IS NULL OR v_faca = '') THEN
    RETURN 'Aguardando Faca';
  END IF;
  IF p_tipo IN ('embalagem','presskit') AND COALESCE(v_aprov,'') <> 'aprovado' THEN
    RETURN 'Aguardando Regulatório';
  END IF;
  RETURN 'Pronto';
END;$$;

COMMENT ON FUNCTION public.calc_briefing_status(text, jsonb) IS
  'Status derivado de prontidão (Pronto/Aguardando Faca/Medidas/KV/Regulatório). Não confundir com briefings.status operacional. Calculado em query, não persistido. Prazo NULL não vira status — vira aviso de UI no PR4.';

-- 9. calc_completeness
CREATE OR REPLACE FUNCTION public.calc_completeness(p_empresa_id integer, p_tipo text, p_payload jsonb)
RETURNS smallint LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total int := 0; v_preench int := 0; r record; v_val text;
BEGIN
  FOR r IN
    SELECT campo, peso FROM public.briefing_campos_obrigatorios
     WHERE empresa_id = p_empresa_id AND tipo = p_tipo AND ativo = true
  LOOP
    v_total := v_total + r.peso;
    BEGIN v_val := p_payload #>> string_to_array(r.campo, '.');
    EXCEPTION WHEN OTHERS THEN v_val := NULL; END;
    IF v_val IS NOT NULL AND v_val <> '' THEN v_preench := v_preench + r.peso; END IF;
  END LOOP;
  IF v_total = 0 THEN RETURN 0; END IF;
  RETURN ROUND(v_preench * 100.0 / v_total)::smallint;
END;$$;

COMMENT ON FUNCTION public.calc_completeness(integer, text, jsonb) IS
  'Retorna 0 quando empresa não tem obrigatórios cadastrados (fallback). Popular via briefing_campos_obrigatorios no PR2. Caminho jsonb suporta nested e arrays (use índice numérico).';

-- 10. rpc_lookup_catalogo
CREATE OR REPLACE FUNCTION public.rpc_lookup_catalogo(p_empresa_id integer, p_marca text, p_tipo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_itens jsonb;
BEGIN
  SELECT itens INTO v_itens FROM public.briefing_catalogos_padrao
   WHERE empresa_id = p_empresa_id AND tipo = p_tipo AND marca = p_marca LIMIT 1;
  IF v_itens IS NOT NULL THEN RETURN v_itens; END IF;
  SELECT itens INTO v_itens FROM public.briefing_catalogos_padrao
   WHERE empresa_id = p_empresa_id AND tipo = p_tipo AND marca IS NULL LIMIT 1;
  RETURN COALESCE(v_itens, '[]'::jsonb);
END;$$;

COMMENT ON FUNCTION public.rpc_lookup_catalogo(integer, text, text) IS
  'Busca catálogo por (empresa, marca, tipo) com fallback: marca específica → marca NULL da empresa → vazio.';

-- 11. rpc_criar_lote_briefings
CREATE OR REPLACE FUNCTION public.rpc_criar_lote_briefings(
  p_intake_demanda_id uuid, p_itens jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_demanda public.intake_demandas;
  v_total int; v_ids uuid[] := ARRAY[]::uuid[];
  v_item jsonb; v_id uuid; v_codigo text; v_payload jsonb; v_pos int := 0;
BEGIN
  SELECT * INTO v_demanda FROM public.intake_demandas WHERE id = p_intake_demanda_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEMANDA_NAO_ENCONTRADA' USING ERRCODE = 'P0001'; END IF;
  IF v_demanda.solicitante_id <> auth.uid() AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO' USING ERRCODE = '42501';
  END IF;
  IF v_demanda.status <> 'em_coleta' THEN
    RAISE EXCEPTION 'LOTE_JA_GERADO' USING ERRCODE = 'P0001';
  END IF;

  v_total := jsonb_array_length(p_itens);
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_pos := v_pos + 1;
    v_codigo := public.gen_codigo_briefing();
    v_payload := COALESCE(v_item->'payload', '{}'::jsonb);
    INSERT INTO public.briefings (
      id, tipo, payload, empresa_id, solicitante_id,
      intake_demanda_id, codigo, posicao_no_lote, total_no_lote,
      completeness_score, status, created_at
    ) VALUES (
      gen_random_uuid(), v_demanda.tipo, v_payload,
      v_demanda.empresa_id, v_demanda.solicitante_id, v_demanda.id,
      v_codigo, v_pos, v_total,
      public.calc_completeness(v_demanda.empresa_id, v_demanda.tipo, v_payload),
      'rascunho', now()
    ) RETURNING id INTO v_id;
    v_ids := array_append(v_ids, v_id);
  END LOOP;

  UPDATE public.intake_demandas
     SET status = 'lote_gerado', total_briefings = v_total, confirmed_at = now()
   WHERE id = p_intake_demanda_id;

  RETURN jsonb_build_object('intake_demanda_id', p_intake_demanda_id, 'briefing_ids', to_jsonb(v_ids), 'total', v_total);
END;$$;

COMMENT ON FUNCTION public.rpc_criar_lote_briefings(uuid, jsonb) IS
  'Cria N briefings a partir de intake_demandas. Idempotente via SELECT FOR UPDATE + status check (LOTE_JA_GERADO). Marca demanda como lote_gerado ao final.';

-- 12. Trigger recalc completeness
CREATE OR REPLACE FUNCTION public.briefings_recalc_completeness_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.completeness_score := public.calc_completeness(NEW.empresa_id, NEW.tipo, NEW.payload);
  RETURN NEW;
END;$$;

CREATE TRIGGER briefings_recalc_completeness
  BEFORE UPDATE ON public.briefings
  FOR EACH ROW
  WHEN (OLD.payload IS DISTINCT FROM NEW.payload)
  EXECUTE FUNCTION public.briefings_recalc_completeness_fn();

-- 13. Trigger auditoria
CREATE OR REPLACE FUNCTION public.briefings_audit_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_diff jsonb := '{}'::jsonb; k text;
BEGIN
  FOR k IN
    SELECT DISTINCT key FROM (
      SELECT jsonb_object_keys(COALESCE(OLD.payload,'{}'::jsonb)) AS key
      UNION
      SELECT jsonb_object_keys(COALESCE(NEW.payload,'{}'::jsonb)) AS key
    ) t
  LOOP
    IF COALESCE(OLD.payload->k, 'null'::jsonb) IS DISTINCT FROM COALESCE(NEW.payload->k, 'null'::jsonb) THEN
      v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('old', OLD.payload->k, 'new', NEW.payload->k));
    END IF;
  END LOOP;
  IF v_diff <> '{}'::jsonb THEN
    INSERT INTO public.briefings_audit (briefing_id, changed_by, diff)
    VALUES (NEW.id, auth.uid(), v_diff);
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER briefings_audit_trigger
  AFTER UPDATE ON public.briefings
  FOR EACH ROW
  WHEN (OLD.payload IS DISTINCT FROM NEW.payload)
  EXECUTE FUNCTION public.briefings_audit_fn();
