
-- ============================================================
-- 1) Estender process_despacho_documento com SLA
-- ============================================================
ALTER TABLE public.process_despacho_documento
  ADD COLUMN IF NOT EXISTS prazo_sla DATE,
  ADD COLUMN IF NOT EXISTS prazo_origem TEXT CHECK (prazo_origem IN ('tarefa','tipo_doc','manual','default')),
  ADD COLUMN IF NOT EXISTS sla_horas_uteis INTEGER,
  ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_status TEXT NOT NULL DEFAULT 'no_prazo',
  ADD COLUMN IF NOT EXISTS prioridade TEXT NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('normal','alta','critica'));

CREATE INDEX IF NOT EXISTS idx_despacho_doc_prazo ON public.process_despacho_documento(prazo_sla) WHERE concluido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_despacho_doc_sla_status ON public.process_despacho_documento(sla_status);

-- Trigger: recalcula sla_status a partir de prazo_sla x now()
CREATE OR REPLACE FUNCTION public.fn_despacho_doc_sla_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_now DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_diff INTEGER;
BEGIN
  IF NEW.concluido_em IS NOT NULL THEN
    NEW.sla_status := 'concluido';
  ELSIF NEW.prazo_sla IS NULL THEN
    NEW.sla_status := 'no_prazo';
  ELSE
    v_diff := NEW.prazo_sla - v_now;
    IF v_diff < 0 THEN NEW.sla_status := 'atrasado';
    ELSIF v_diff <= 1 THEN NEW.sla_status := 'em_risco';
    ELSE NEW.sla_status := 'no_prazo';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_despacho_doc_sla_status ON public.process_despacho_documento;
CREATE TRIGGER trg_despacho_doc_sla_status
  BEFORE INSERT OR UPDATE OF prazo_sla, concluido_em, status
  ON public.process_despacho_documento
  FOR EACH ROW EXECUTE FUNCTION public.fn_despacho_doc_sla_status();

-- ============================================================
-- 2) Tabela de SLA padrão por tipo de documento
-- ============================================================
CREATE TABLE IF NOT EXISTS public.china_doc_sla_default (
  tipo_documento TEXT PRIMARY KEY,
  horas_uteis INTEGER NOT NULL DEFAULT 72,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.china_doc_sla_default ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_default_select" ON public.china_doc_sla_default;
CREATE POLICY "sla_default_select" ON public.china_doc_sla_default
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sla_default_admin_write" ON public.china_doc_sla_default;
CREATE POLICY "sla_default_admin_write" ON public.china_doc_sla_default
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.china_doc_sla_default (tipo_documento, horas_uteis, descricao) VALUES
  ('rotulo_arte', 24, 'Aprovação de arte de rótulo'),
  ('msds', 72, 'Ficha de segurança (MSDS/SDS)'),
  ('coa', 48, 'Certificado de análise'),
  ('bom', 72, 'Lista técnica/BOM'),
  ('foto_produto', 48, 'Foto do produto'),
  ('ficha_tecnica', 72, 'Ficha técnica do produto'),
  ('embalagem_arte', 48, 'Arte de embalagem'),
  ('inci', 72, 'Composição INCI'),
  ('amostra_fisica', 120, 'Amostra física'),
  ('certificado', 96, 'Certificados regulatórios')
ON CONFLICT (tipo_documento) DO NOTHING;

-- ============================================================
-- 3) Tabela de alertas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.china_doc_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submissao_id UUID NOT NULL REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  documento_id UUID REFERENCES public.china_produto_documentos(id) ON DELETE CASCADE,
  despacho_id UUID REFERENCES public.process_despacho_documento(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('nao_despachado','sem_destino','em_risco','vencido','sem_responsavel')),
  severidade TEXT NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa','media','alta','critica')),
  mensagem TEXT NOT NULL,
  sugestao JSONB DEFAULT '{}'::jsonb,
  dispensado_em TIMESTAMPTZ,
  dispensado_por UUID,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_china_alertas_submissao ON public.china_doc_alertas(submissao_id) WHERE dispensado_em IS NULL AND resolvido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_china_alertas_tipo ON public.china_doc_alertas(tipo);
CREATE INDEX IF NOT EXISTS idx_china_alertas_severidade ON public.china_doc_alertas(severidade);
CREATE UNIQUE INDEX IF NOT EXISTS uq_china_alertas_dedup
  ON public.china_doc_alertas(submissao_id, COALESCE(documento_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo)
  WHERE dispensado_em IS NULL AND resolvido_em IS NULL;

ALTER TABLE public.china_doc_alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alertas_select" ON public.china_doc_alertas;
CREATE POLICY "alertas_select" ON public.china_doc_alertas
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "alertas_insert" ON public.china_doc_alertas;
CREATE POLICY "alertas_insert" ON public.china_doc_alertas
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "alertas_update" ON public.china_doc_alertas;
CREATE POLICY "alertas_update" ON public.china_doc_alertas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "alertas_delete" ON public.china_doc_alertas;
CREATE POLICY "alertas_delete" ON public.china_doc_alertas
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4) RPC para recalcular alertas de uma submissão
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_recalcular_alertas_china(_submissao_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Marcar resolvidos os alertas cujo motivo deixou de existir
  UPDATE public.china_doc_alertas a
     SET resolvido_em = now()
   WHERE a.submissao_id = _submissao_id
     AND a.dispensado_em IS NULL
     AND a.resolvido_em IS NULL
     AND (
       (a.tipo = 'nao_despachado' AND EXISTS (
         SELECT 1 FROM public.process_despacho_documento d
         WHERE d.documento_id = a.documento_id AND d.submissao_id = _submissao_id
       ))
       OR (a.tipo IN ('em_risco','vencido') AND EXISTS (
         SELECT 1 FROM public.process_despacho_documento d
         WHERE d.id = a.despacho_id AND d.concluido_em IS NOT NULL
       ))
     );

  -- Inserir 'nao_despachado' para documentos sem despacho
  INSERT INTO public.china_doc_alertas (submissao_id, documento_id, tipo, severidade, mensagem, sugestao)
  SELECT
    _submissao_id, doc.id, 'nao_despachado', 'media',
    'Documento ' || COALESCE(doc.nome_arquivo, doc.tipo_documento) || ' ainda não foi despachado.',
    jsonb_build_object('tipo_documento', doc.tipo_documento)
  FROM public.china_produto_documentos doc
  WHERE doc.submissao_id = _submissao_id
    AND NOT EXISTS (
      SELECT 1 FROM public.process_despacho_documento d
      WHERE d.documento_id = doc.id AND d.submissao_id = _submissao_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.china_doc_alertas a
      WHERE a.submissao_id = _submissao_id
        AND a.documento_id = doc.id
        AND a.tipo = 'nao_despachado'
        AND a.dispensado_em IS NULL
        AND a.resolvido_em IS NULL
    )
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Inserir 'em_risco' / 'vencido' para despachos abertos com prazo
  INSERT INTO public.china_doc_alertas (submissao_id, documento_id, despacho_id, tipo, severidade, mensagem, sugestao)
  SELECT
    _submissao_id, d.documento_id, d.id,
    CASE WHEN d.sla_status = 'atrasado' THEN 'vencido' ELSE 'em_risco' END,
    CASE WHEN d.sla_status = 'atrasado' THEN 'critica' ELSE 'alta' END,
    CASE WHEN d.sla_status = 'atrasado'
      THEN 'Despacho atrasado: prazo era ' || to_char(d.prazo_sla, 'DD/MM/YYYY') || '.'
      ELSE 'Despacho vence em breve (' || to_char(d.prazo_sla, 'DD/MM/YYYY') || ').'
    END,
    jsonb_build_object('despacho_id', d.id, 'prazo_sla', d.prazo_sla)
  FROM public.process_despacho_documento d
  WHERE d.submissao_id = _submissao_id
    AND d.concluido_em IS NULL
    AND d.sla_status IN ('em_risco','atrasado')
    AND NOT EXISTS (
      SELECT 1 FROM public.china_doc_alertas a
      WHERE a.despacho_id = d.id
        AND a.tipo IN ('em_risco','vencido')
        AND a.dispensado_em IS NULL
        AND a.resolvido_em IS NULL
    )
  ON CONFLICT DO NOTHING;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_recalcular_alertas_china(UUID) TO authenticated;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.china_doc_alertas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.process_despacho_documento;
