
-- =========================================================
-- China — Linha do Tempo Unificada
-- =========================================================

-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.china_timeline_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  title text NOT NULL,
  descricao text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  actor_label text,
  submissao_id uuid REFERENCES public.china_produto_submissoes(id) ON DELETE CASCADE,
  ordem_compra_id uuid REFERENCES public.china_ordens_compra(id) ON DELETE CASCADE,
  ordem_producao_id uuid,
  embarque_id uuid REFERENCES public.china_embarques(id) ON DELETE SET NULL,
  container_id uuid,
  recebimento_id uuid REFERENCES public.china_recebimentos_carga(id) ON DELETE SET NULL,
  nc_id uuid REFERENCES public.china_nao_conformidades(id) ON DELETE SET NULL,
  documento_id uuid,
  produto_codigo text,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cte_submissao ON public.china_timeline_eventos(submissao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cte_oc ON public.china_timeline_eventos(ordem_compra_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cte_emb ON public.china_timeline_eventos(embarque_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cte_receb ON public.china_timeline_eventos(recebimento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cte_nc ON public.china_timeline_eventos(nc_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cte_kind ON public.china_timeline_eventos(kind);

ALTER TABLE public.china_timeline_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cte_select_auth" ON public.china_timeline_eventos;
CREATE POLICY "cte_select_auth" ON public.china_timeline_eventos
  FOR SELECT TO authenticated USING (true);

-- Sem políticas de INSERT/UPDATE/DELETE: apenas funções SECURITY DEFINER podem escrever.

-- 2. Função genérica de log (server-side e client-side via RPC)
CREATE OR REPLACE FUNCTION public.rpc_china_log_evento(
  p_kind text,
  p_title text,
  p_descricao text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_submissao_id uuid DEFAULT NULL,
  p_ordem_compra_id uuid DEFAULT NULL,
  p_ordem_producao_id uuid DEFAULT NULL,
  p_embarque_id uuid DEFAULT NULL,
  p_container_id uuid DEFAULT NULL,
  p_recebimento_id uuid DEFAULT NULL,
  p_nc_id uuid DEFAULT NULL,
  p_documento_id uuid DEFAULT NULL,
  p_produto_codigo text DEFAULT NULL,
  p_dedupe_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_actor uuid := auth.uid();
BEGIN
  INSERT INTO public.china_timeline_eventos (
    kind, title, descricao, payload, actor_id,
    submissao_id, ordem_compra_id, ordem_producao_id, embarque_id,
    container_id, recebimento_id, nc_id, documento_id, produto_codigo,
    dedupe_key
  ) VALUES (
    p_kind, p_title, p_descricao, COALESCE(p_payload, '{}'::jsonb), v_actor,
    p_submissao_id, p_ordem_compra_id, p_ordem_producao_id, p_embarque_id,
    p_container_id, p_recebimento_id, p_nc_id, p_documento_id, p_produto_codigo,
    p_dedupe_key
  )
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_china_log_evento(
  text, text, text, jsonb, uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text
) TO authenticated;

-- 3. Triggers automáticos
CREATE OR REPLACE FUNCTION public.trg_cte_submissoes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, submissao_id, produto_codigo, actor_id, dedupe_key)
    VALUES ('submissao_criada', 'Submissão criada', NEW.produto_codigo || ' — ' || NEW.produto_nome, NEW.id, NEW.produto_codigo, NEW.created_by, 'sub-criada-' || NEW.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND COALESCE(NEW.status,'') <> COALESCE(OLD.status,'') THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, payload, submissao_id, produto_codigo, dedupe_key)
    VALUES ('submissao_status', 'Submissão: ' || NEW.status, OLD.status || ' → ' || NEW.status, jsonb_build_object('de', OLD.status, 'para', NEW.status), NEW.id, NEW.produto_codigo, 'sub-status-' || NEW.id || '-' || NEW.status || '-' || extract(epoch from now())::text)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cte_submissoes_aiu ON public.china_produto_submissoes;
CREATE TRIGGER trg_cte_submissoes_aiu
AFTER INSERT OR UPDATE ON public.china_produto_submissoes
FOR EACH ROW EXECUTE FUNCTION public.trg_cte_submissoes();

CREATE OR REPLACE FUNCTION public.trg_cte_documentos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, submissao_id, documento_id, dedupe_key)
    VALUES ('documento_anexado', 'Documento anexado', COALESCE(NEW.nome_arquivo, NEW.tipo_documento), NEW.submissao_id, NEW.id, 'doc-add-' || NEW.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND COALESCE(NEW.status,'') <> COALESCE(OLD.status,'') THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, payload, submissao_id, documento_id, dedupe_key)
    VALUES ('documento_status', 'Documento: ' || NEW.status, COALESCE(NEW.nome_arquivo, NEW.tipo_documento), jsonb_build_object('de', OLD.status, 'para', NEW.status), NEW.submissao_id, NEW.id, 'doc-status-' || NEW.id || '-' || NEW.status)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cte_documentos_aiu ON public.china_produto_documentos;
CREATE TRIGGER trg_cte_documentos_aiu
AFTER INSERT OR UPDATE ON public.china_produto_documentos
FOR EACH ROW EXECUTE FUNCTION public.trg_cte_documentos();

CREATE OR REPLACE FUNCTION public.trg_cte_oc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, submissao_id, ordem_compra_id, produto_codigo, actor_id, dedupe_key)
    VALUES ('oc_emitida', 'OC emitida', NEW.numero_oc, NEW.submissao_id, NEW.id, NEW.produto_codigo, NEW.created_by, 'oc-emit-' || NEW.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND COALESCE(NEW.status,'') <> COALESCE(OLD.status,'') THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, payload, submissao_id, ordem_compra_id, produto_codigo, dedupe_key)
    VALUES ('oc_status', 'OC ' || NEW.numero_oc || ': ' || NEW.status, OLD.status || ' → ' || NEW.status, jsonb_build_object('de', OLD.status, 'para', NEW.status), NEW.submissao_id, NEW.id, NEW.produto_codigo, 'oc-status-' || NEW.id || '-' || NEW.status)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cte_oc_aiu ON public.china_ordens_compra;
CREATE TRIGGER trg_cte_oc_aiu
AFTER INSERT OR UPDATE ON public.china_ordens_compra
FOR EACH ROW EXECUTE FUNCTION public.trg_cte_oc();

CREATE OR REPLACE FUNCTION public.trg_cte_apontamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.china_timeline_eventos(kind, title, descricao, payload, ordem_compra_id, actor_id, dedupe_key)
  VALUES ('apontamento_producao', 'Apontamento de produção', NEW.cor_nome || ' — ' || NEW.quantidade::text, jsonb_build_object('cor', NEW.cor_nome, 'qtd', NEW.quantidade, 'lote', NEW.lote, 'data', NEW.data_producao), NEW.ordem_compra_id, NEW.created_by, 'apont-' || NEW.id)
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cte_apont_ai ON public.china_producao_apontamentos;
CREATE TRIGGER trg_cte_apont_ai
AFTER INSERT ON public.china_producao_apontamentos
FOR EACH ROW EXECUTE FUNCTION public.trg_cte_apontamento();

CREATE OR REPLACE FUNCTION public.trg_cte_embarque()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, payload, ordem_compra_id, embarque_id, actor_id, dedupe_key)
    VALUES ('embarque_criado', 'Embarque criado', COALESCE(NEW.numero_container, NEW.numero_bl, NEW.booking_number, 'sem identificador'), jsonb_build_object('navio', NEW.navio, 'porto_origem', NEW.porto_origem, 'porto_destino', NEW.porto_destino, 'data_embarque', NEW.data_embarque, 'data_eta', NEW.data_eta), NEW.ordem_compra_id, NEW.id, NEW.created_by, 'emb-criado-' || NEW.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND COALESCE(NEW.status,'') <> COALESCE(OLD.status,'') THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, payload, ordem_compra_id, embarque_id, dedupe_key)
    VALUES ('embarque_status', 'Embarque: ' || NEW.status, OLD.status || ' → ' || NEW.status, jsonb_build_object('de', OLD.status, 'para', NEW.status), NEW.ordem_compra_id, NEW.id, 'emb-status-' || NEW.id || '-' || NEW.status)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cte_embarque_aiu ON public.china_embarques;
CREATE TRIGGER trg_cte_embarque_aiu
AFTER INSERT OR UPDATE ON public.china_embarques
FOR EACH ROW EXECUTE FUNCTION public.trg_cte_embarque();

CREATE OR REPLACE FUNCTION public.trg_cte_recebimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, ordem_compra_id, embarque_id, recebimento_id, actor_id, dedupe_key)
    VALUES ('recebimento_iniciado', 'Recebimento iniciado', COALESCE(NEW.numero_di, 'sem DI'), NEW.ordem_compra_id, NEW.embarque_id, NEW.id, NEW.created_by, 'receb-criado-' || NEW.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND COALESCE(NEW.status,'') <> COALESCE(OLD.status,'') THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, payload, ordem_compra_id, embarque_id, recebimento_id, dedupe_key)
    VALUES ('recebimento_status', 'Recebimento: ' || NEW.status, OLD.status || ' → ' || NEW.status, jsonb_build_object('de', OLD.status, 'para', NEW.status), NEW.ordem_compra_id, NEW.embarque_id, NEW.id, 'receb-status-' || NEW.id || '-' || NEW.status)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cte_receb_aiu ON public.china_recebimentos_carga;
CREATE TRIGGER trg_cte_receb_aiu
AFTER INSERT OR UPDATE ON public.china_recebimentos_carga
FOR EACH ROW EXECUTE FUNCTION public.trg_cte_recebimento();

CREATE OR REPLACE FUNCTION public.trg_cte_nc()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, payload, ordem_compra_id, embarque_id, recebimento_id, nc_id, actor_id, dedupe_key)
    VALUES ('nc_aberta', 'Não conformidade aberta: ' || NEW.numero_nc, NEW.descricao, jsonb_build_object('tipo', NEW.tipo, 'severidade', NEW.severidade, 'qty', NEW.qty_envolvida), NEW.ordem_compra_id, NEW.embarque_id, NEW.recebimento_id, NEW.id, NEW.aberta_por, 'nc-criada-' || NEW.id)
    ON CONFLICT (dedupe_key) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' AND COALESCE(NEW.status,'') <> COALESCE(OLD.status,'') THEN
    INSERT INTO public.china_timeline_eventos(kind, title, descricao, payload, ordem_compra_id, embarque_id, recebimento_id, nc_id, dedupe_key)
    VALUES ('nc_status', 'NC ' || NEW.numero_nc || ': ' || NEW.status, OLD.status || ' → ' || NEW.status, jsonb_build_object('de', OLD.status, 'para', NEW.status), NEW.ordem_compra_id, NEW.embarque_id, NEW.recebimento_id, NEW.id, 'nc-status-' || NEW.id || '-' || NEW.status)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_cte_nc_aiu ON public.china_nao_conformidades;
CREATE TRIGGER trg_cte_nc_aiu
AFTER INSERT OR UPDATE ON public.china_nao_conformidades
FOR EACH ROW EXECUTE FUNCTION public.trg_cte_nc();

-- 4. Backfill histórico
INSERT INTO public.china_timeline_eventos (kind, title, descricao, submissao_id, produto_codigo, actor_id, created_at, dedupe_key)
SELECT 'submissao_criada', 'Submissão criada', s.produto_codigo || ' — ' || s.produto_nome, s.id, s.produto_codigo, s.created_by, s.created_at, 'sub-criada-' || s.id
FROM public.china_produto_submissoes s
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO public.china_timeline_eventos (kind, title, descricao, submissao_id, documento_id, created_at, dedupe_key)
SELECT 'documento_anexado', 'Documento anexado', COALESCE(d.nome_arquivo, d.tipo_documento), d.submissao_id, d.id, d.created_at, 'doc-add-' || d.id
FROM public.china_produto_documentos d
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO public.china_timeline_eventos (kind, title, descricao, submissao_id, ordem_compra_id, produto_codigo, actor_id, created_at, dedupe_key)
SELECT 'oc_emitida', 'OC emitida', o.numero_oc, o.submissao_id, o.id, o.produto_codigo, o.created_by, o.created_at, 'oc-emit-' || o.id
FROM public.china_ordens_compra o
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO public.china_timeline_eventos (kind, title, descricao, payload, ordem_compra_id, actor_id, created_at, dedupe_key)
SELECT 'apontamento_producao', 'Apontamento de produção', a.cor_nome || ' — ' || a.quantidade::text,
       jsonb_build_object('cor', a.cor_nome, 'qtd', a.quantidade, 'lote', a.lote, 'data', a.data_producao),
       a.ordem_compra_id, a.created_by, a.created_at, 'apont-' || a.id
FROM public.china_producao_apontamentos a
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO public.china_timeline_eventos (kind, title, descricao, payload, ordem_compra_id, embarque_id, actor_id, created_at, dedupe_key)
SELECT 'embarque_criado', 'Embarque criado', COALESCE(e.numero_container, e.numero_bl, e.booking_number, 'sem identificador'),
       jsonb_build_object('navio', e.navio, 'porto_origem', e.porto_origem, 'porto_destino', e.porto_destino),
       e.ordem_compra_id, e.id, e.created_by, e.created_at, 'emb-criado-' || e.id
FROM public.china_embarques e
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO public.china_timeline_eventos (kind, title, descricao, ordem_compra_id, embarque_id, recebimento_id, actor_id, created_at, dedupe_key)
SELECT 'recebimento_iniciado', 'Recebimento iniciado', COALESCE(r.numero_di, 'sem DI'), r.ordem_compra_id, r.embarque_id, r.id, r.created_by, r.created_at, 'receb-criado-' || r.id
FROM public.china_recebimentos_carga r
ON CONFLICT (dedupe_key) DO NOTHING;

INSERT INTO public.china_timeline_eventos (kind, title, descricao, payload, ordem_compra_id, embarque_id, recebimento_id, nc_id, actor_id, created_at, dedupe_key)
SELECT 'nc_aberta', 'Não conformidade aberta: ' || n.numero_nc, n.descricao,
       jsonb_build_object('tipo', n.tipo, 'severidade', n.severidade, 'qty', n.qty_envolvida),
       n.ordem_compra_id, n.embarque_id, n.recebimento_id, n.id, n.aberta_por, n.created_at, 'nc-criada-' || n.id
FROM public.china_nao_conformidades n
ON CONFLICT (dedupe_key) DO NOTHING;
