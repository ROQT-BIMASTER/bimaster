-- Permitir a decisão "reaberto" na trilha homologada
ALTER TABLE public.china_doc_aprovacoes_audit
  DROP CONSTRAINT IF EXISTS china_doc_aprovacoes_audit_decisao_check;
ALTER TABLE public.china_doc_aprovacoes_audit
  ADD CONSTRAINT china_doc_aprovacoes_audit_decisao_check
  CHECK (decisao IN ('em_analise','pendente','aprovado','rejeitado','ciencia','reaberto'));

-- Reabertura de documento para nova análise (exige step-up por senha)
CREATE OR REPLACE FUNCTION public.rpc_china_reabrir_documento(
  p_documento_id uuid,
  p_step_up_token text,
  p_motivo text,
  p_novo_status text DEFAULT 'em_analise',
  p_tarefa_id uuid DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_origem text DEFAULT 'tarefa',
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
  IF p_novo_status NOT IN ('em_analise','pendente') THEN
    RAISE EXCEPTION 'Situação inválida para reabertura: %', p_novo_status;
  END IF;
  IF COALESCE(btrim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo da reabertura.';
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

  IF _doc.status NOT IN ('aprovado','rejeitado') THEN
    RAISE EXCEPTION 'Apenas documentos já homologados podem ser reabertos.';
  END IF;

  SELECT nome, email INTO _nome, _email FROM public.profiles WHERE id = _uid;

  UPDATE public.china_produto_documentos
  SET status = p_novo_status
  WHERE id = p_documento_id;

  INSERT INTO public.china_doc_aprovacoes_audit (
    documento_id, submissao_id, tarefa_id, projeto_id, decisao, status_anterior,
    parecer, decidido_por, decidido_por_nome, decidido_por_email,
    metodo_confirmacao, origem
  ) VALUES (
    p_documento_id, _doc.submissao_id, p_tarefa_id, p_projeto_id, 'reaberto', _doc.status,
    btrim(p_motivo), _uid, _nome, _email, COALESCE(p_metodo, 'senha'),
    COALESCE(p_origem, 'tarefa') || ':reabertura'
  ) RETURNING id INTO _audit_id;

  PERFORM public.china_doc_notificar_status(
    p_documento_id, p_novo_status, _doc.status, _uid, _nome,
    'Reaberto para nova análise. Motivo: ' || btrim(p_motivo),
    p_projeto_id, p_tarefa_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'audit_id', _audit_id,
    'documento_id', p_documento_id,
    'status', p_novo_status,
    'status_anterior', _doc.status,
    'reaberto_por_nome', _nome,
    'reaberto_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_reabrir_documento(uuid, text, text, text, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_reabrir_documento(uuid, text, text, text, uuid, uuid, text, text) TO authenticated;