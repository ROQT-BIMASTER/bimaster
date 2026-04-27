-- 1. Campos extras na submissão para auditoria de auto-avanço
ALTER TABLE public.china_produto_submissoes
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS alerta_em timestamptz;

-- 2. Função: recalcula status da submissão quando docs mudam
CREATE OR REPLACE FUNCTION public.tg_china_submissao_auto_avanco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub_id uuid;
  v_total INT;
  v_aprovados INT;
  v_rejeitados INT;
  v_pendentes INT;
  v_current_status text;
BEGIN
  v_sub_id := COALESCE(NEW.submissao_id, OLD.submissao_id);
  IF v_sub_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('aprovado','ciencia')),
    COUNT(*) FILTER (WHERE status = 'rejeitado'),
    COUNT(*) FILTER (WHERE status IN ('pendente','enviado','em_revisao'))
    INTO v_total, v_aprovados, v_rejeitados, v_pendentes
  FROM public.china_produto_documentos
  WHERE submissao_id = v_sub_id;

  SELECT status INTO v_current_status
  FROM public.china_produto_submissoes
  WHERE id = v_sub_id;

  IF v_total = 0 THEN
    RETURN NEW;
  END IF;

  IF v_aprovados = v_total AND v_current_status <> 'aprovado' THEN
    UPDATE public.china_produto_submissoes
       SET status = 'aprovado',
           aprovado_em = now(),
           updated_at = now()
     WHERE id = v_sub_id;
  ELSIF v_rejeitados > 0 AND v_current_status NOT IN ('aprovado','ajuste_necessario') THEN
    UPDATE public.china_produto_submissoes
       SET status = 'ajuste_necessario',
           updated_at = now()
     WHERE id = v_sub_id;
  ELSIF v_pendentes > 0 AND v_current_status IN ('rascunho') THEN
    UPDATE public.china_produto_submissoes
       SET status = 'em_revisao',
           updated_at = now()
     WHERE id = v_sub_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_doc_auto_avanco ON public.china_produto_documentos;
CREATE TRIGGER trg_china_doc_auto_avanco
AFTER INSERT OR UPDATE OF status OR DELETE
ON public.china_produto_documentos
FOR EACH ROW
EXECUTE FUNCTION public.tg_china_submissao_auto_avanco();

-- 3. Função: cria notificação automática quando docs mudam de status
CREATE OR REPLACE FUNCTION public.tg_china_doc_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub RECORD;
  v_target uuid;
  v_title text;
  v_message text;
  v_action_url text;
BEGIN
  -- Só notifica em mudança de status (não em ações iniciais)
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT id, produto_codigo, produto_nome, created_by
    INTO v_sub
  FROM public.china_produto_submissoes
  WHERE id = NEW.submissao_id;

  IF v_sub.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_action_url := '/dashboard/fabrica-china/caixa-entrada?submissao=' || v_sub.id::text;

  IF NEW.status = 'aprovado' THEN
    v_target := v_sub.created_by;
    v_title := '✅ Documento aprovado / 文件已批准';
    v_message := v_sub.produto_codigo || ' — ' || NEW.tipo_documento || ' aprovado pelo Brasil';
  ELSIF NEW.status = 'rejeitado' THEN
    v_target := v_sub.created_by;
    v_title := '❌ Ajuste solicitado / 需要修正';
    v_message := v_sub.produto_codigo || ' — ' || NEW.tipo_documento || ' precisa de correção';
  ELSIF NEW.status = 'ciencia' THEN
    -- ciência pela China: notifica o Brasil (created_by da submissão)
    v_target := v_sub.created_by;
    v_title := '👁 Ciência registrada / 已确认';
    v_message := v_sub.produto_codigo || ' — ' || NEW.tipo_documento;
  ELSIF NEW.status IN ('pendente','enviado') AND TG_OP = 'INSERT' THEN
    -- Documento novo: avisa o time Brasil (todos com acesso fabrica)
    v_target := v_sub.created_by;
    v_title := '📩 Novo documento da China / 新文件来自中国';
    v_message := v_sub.produto_codigo || ' — ' || NEW.tipo_documento;
  ELSE
    RETURN NEW;
  END IF;

  IF v_target IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, action_url, type)
    VALUES (v_target, v_title, v_message, v_action_url, 'china_aprovacao')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_doc_notify ON public.china_produto_documentos;
CREATE TRIGGER trg_china_doc_notify
AFTER INSERT OR UPDATE OF status
ON public.china_produto_documentos
FOR EACH ROW
EXECUTE FUNCTION public.tg_china_doc_notify();

-- 4. Realtime: garante que mudanças nessas tabelas chegam ao cliente
ALTER TABLE public.china_produto_documentos REPLICA IDENTITY FULL;
ALTER TABLE public.china_produto_submissoes REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'china_produto_documentos'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.china_produto_documentos';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'china_produto_submissoes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.china_produto_submissoes';
  END IF;
END $$;

-- 5. Índice para a Caixa de Entrada filtrar rápido por status
CREATE INDEX IF NOT EXISTS idx_china_doc_status ON public.china_produto_documentos (status, submissao_id);
CREATE INDEX IF NOT EXISTS idx_china_sub_status_created ON public.china_produto_submissoes (status, created_at DESC);