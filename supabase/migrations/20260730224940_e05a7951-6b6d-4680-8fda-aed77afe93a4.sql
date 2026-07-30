-- 1) Trilha homologada de decisões sobre documentos da China
CREATE TABLE IF NOT EXISTS public.china_doc_aprovacoes_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL,
  submissao_id uuid,
  tarefa_id uuid,
  projeto_id uuid,
  decisao text NOT NULL CHECK (decisao IN ('em_analise','pendente','aprovado','rejeitado','ciencia')),
  status_anterior text,
  parecer text,
  decidido_por uuid NOT NULL,
  decidido_por_nome text,
  decidido_por_email text,
  metodo_confirmacao text NOT NULL DEFAULT 'senha',
  origem text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cdaa_documento ON public.china_doc_aprovacoes_audit(documento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdaa_submissao ON public.china_doc_aprovacoes_audit(submissao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cdaa_tarefa ON public.china_doc_aprovacoes_audit(tarefa_id, created_at DESC);

GRANT SELECT ON public.china_doc_aprovacoes_audit TO authenticated;
GRANT ALL ON public.china_doc_aprovacoes_audit TO service_role;

ALTER TABLE public.china_doc_aprovacoes_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cdaa_select_auth" ON public.china_doc_aprovacoes_audit;
CREATE POLICY "cdaa_select_auth" ON public.china_doc_aprovacoes_audit
  FOR SELECT TO authenticated USING (true);

-- Imutabilidade: sem policies de INSERT/UPDATE/DELETE para authenticated;
-- gravação apenas via funções SECURITY DEFINER abaixo.
CREATE OR REPLACE FUNCTION public.china_doc_aprovacoes_audit_block()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Trilha de aprovação é imutável.';
END;
$$;

DROP TRIGGER IF EXISTS trg_cdaa_immutable ON public.china_doc_aprovacoes_audit;
CREATE TRIGGER trg_cdaa_immutable
BEFORE UPDATE OR DELETE ON public.china_doc_aprovacoes_audit
FOR EACH ROW EXECUTE FUNCTION public.china_doc_aprovacoes_audit_block();

-- 2) Decisão homologada (exige token de step-up por senha)
CREATE OR REPLACE FUNCTION public.rpc_china_aprovar_documento(
  p_documento_id uuid,
  p_decisao text,
  p_step_up_token text,
  p_parecer text DEFAULT NULL,
  p_tarefa_id uuid DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_origem text DEFAULT 'kanban',
  p_metodo text DEFAULT 'senha'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _doc RECORD;
  _nome text;
  _email text;
  _ok boolean;
  _audit_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada.' USING ERRCODE = '28000';
  END IF;
  IF p_decisao NOT IN ('aprovado','rejeitado') THEN
    RAISE EXCEPTION 'Decisão inválida para homologação: %', p_decisao;
  END IF;
  IF p_step_up_token IS NULL OR length(p_step_up_token) < 16 THEN
    RAISE EXCEPTION 'Confirmação de senha obrigatória.' USING ERRCODE = '28000';
  END IF;

  _ok := public.validate_step_up_token(
    _uid,
    encode(extensions.digest(p_step_up_token, 'sha256'), 'hex'),
    'china.doc_approval'
  );
  IF NOT _ok THEN
    RAISE EXCEPTION 'Confirmação de identidade inválida ou expirada.' USING ERRCODE = '28000';
  END IF;

  SELECT id, submissao_id, status INTO _doc
  FROM public.china_produto_documentos WHERE id = p_documento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento não encontrado.';
  END IF;

  SELECT nome, email INTO _nome, _email FROM public.profiles WHERE id = _uid;

  UPDATE public.china_produto_documentos
  SET status = p_decisao,
      observacoes_brasil = COALESCE(NULLIF(p_parecer, ''), observacoes_brasil)
  WHERE id = p_documento_id;

  INSERT INTO public.china_doc_aprovacoes_audit (
    documento_id, submissao_id, tarefa_id, projeto_id, decisao, status_anterior,
    parecer, decidido_por, decidido_por_nome, decidido_por_email,
    metodo_confirmacao, origem
  ) VALUES (
    p_documento_id, _doc.submissao_id, p_tarefa_id, p_projeto_id, p_decisao, _doc.status,
    NULLIF(p_parecer, ''), _uid, _nome, _email, COALESCE(p_metodo, 'senha'), p_origem
  ) RETURNING id INTO _audit_id;

  RETURN jsonb_build_object(
    'ok', true,
    'audit_id', _audit_id,
    'documento_id', p_documento_id,
    'status', p_decisao,
    'decidido_por_nome', _nome,
    'decidido_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_aprovar_documento(uuid, text, text, text, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_aprovar_documento(uuid, text, text, text, uuid, uuid, text, text) TO authenticated;

-- 3) Estados intermediários (sem step-up), com trilha
CREATE OR REPLACE FUNCTION public.rpc_china_definir_status_documento(
  p_documento_id uuid,
  p_status text,
  p_tarefa_id uuid DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_origem text DEFAULT 'kanban'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _doc RECORD;
  _nome text;
  _email text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada.' USING ERRCODE = '28000';
  END IF;
  IF p_status NOT IN ('em_analise','pendente') THEN
    RAISE EXCEPTION 'Status inválido nesta rotina: %', p_status;
  END IF;

  SELECT id, submissao_id, status INTO _doc
  FROM public.china_produto_documentos WHERE id = p_documento_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Documento não encontrado.';
  END IF;

  IF _doc.status = 'aprovado' THEN
    RAISE EXCEPTION 'Documento aprovado não pode voltar para % sem nova revisão.', p_status;
  END IF;

  SELECT nome, email INTO _nome, _email FROM public.profiles WHERE id = _uid;

  UPDATE public.china_produto_documentos
  SET status = p_status WHERE id = p_documento_id;

  INSERT INTO public.china_doc_aprovacoes_audit (
    documento_id, submissao_id, tarefa_id, projeto_id, decisao, status_anterior,
    decidido_por, decidido_por_nome, decidido_por_email, metodo_confirmacao, origem
  ) VALUES (
    p_documento_id, _doc.submissao_id, p_tarefa_id, p_projeto_id, p_status, _doc.status,
    _uid, _nome, _email, 'sessao', p_origem
  );

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_definir_status_documento(uuid, text, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_definir_status_documento(uuid, text, uuid, uuid, text) TO authenticated;