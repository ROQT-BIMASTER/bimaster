-- 1) Notificação automática de mudança de situação de documento
CREATE OR REPLACE FUNCTION public.china_doc_notificar_status(
  p_documento_id uuid,
  p_status text,
  p_status_anterior text,
  p_ator uuid,
  p_ator_nome text,
  p_parecer text DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_tarefa_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _doc RECORD;
  _label text;
  _titulo text;
  _msg text;
  _url text;
  _dest uuid;
  _n integer := 0;
  _nomes text := '';
BEGIN
  SELECT id, nome_arquivo, tipo_documento, submissao_id
    INTO _doc
  FROM public.china_produto_documentos WHERE id = p_documento_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  _label := COALESCE(NULLIF(_doc.nome_arquivo, ''), _doc.tipo_documento, 'Documento');

  _titulo := CASE p_status
    WHEN 'aprovado' THEN 'Documento aprovado'
    WHEN 'rejeitado' THEN 'Documento não aprovado'
    WHEN 'em_analise' THEN 'Documento em análise'
    ELSE 'Documento pendente de aprovação'
  END;

  _msg := _label || ' — situação alterada por ' || COALESCE(p_ator_nome, 'um usuário')
          || COALESCE('. Parecer: ' || NULLIF(p_parecer, ''), '');

  _url := CASE
    WHEN p_projeto_id IS NOT NULL AND p_tarefa_id IS NOT NULL
      THEN '/dashboard/projetos/' || p_projeto_id::text || '?tarefa=' || p_tarefa_id::text
    WHEN p_projeto_id IS NOT NULL THEN '/dashboard/projetos/' || p_projeto_id::text
    ELSE NULL
  END;

  FOR _dest IN
    SELECT DISTINCT u FROM (
      SELECT t.responsavel_id AS u
        FROM public.projeto_tarefas t
       WHERE p_tarefa_id IS NOT NULL AND t.id = p_tarefa_id
      UNION
      SELECT v.responsavel_id
        FROM public.china_documento_tarefa_vinculos v
       WHERE v.documento_id = p_documento_id
      UNION
      SELECT v.created_by
        FROM public.china_documento_tarefa_vinculos v
       WHERE v.documento_id = p_documento_id
    ) s
    WHERE u IS NOT NULL AND u <> COALESCE(p_ator, '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (_dest, 'china_doc_status', _titulo, _msg, _url);
    _n := _n + 1;
    _nomes := _nomes || COALESCE((SELECT nome FROM public.profiles WHERE id = _dest), _dest::text) || '; ';
  END LOOP;

  INSERT INTO public.china_produto_documentos_historico (
    documento_id, submissao_id, tipo_documento, nome_arquivo, status,
    observacao, versionado_por, acao
  ) VALUES (
    p_documento_id, _doc.submissao_id, _doc.tipo_documento, _doc.nome_arquivo, p_status,
    'Situação alterada de ' || COALESCE(p_status_anterior, '—') || ' para ' || p_status
      || COALESCE(' | Parecer: ' || NULLIF(p_parecer, ''), '')
      || CASE WHEN _n > 0 THEN ' | Notificados: ' || _nomes ELSE ' | Sem destinatários para notificar' END,
    p_ator, 'notificacao_status'
  );

  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.china_doc_notificar_status(uuid, text, text, uuid, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.china_doc_notificar_status(uuid, text, text, uuid, text, text, uuid, uuid) TO authenticated, service_role;

-- 2) Aprovação individual passa a notificar
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

  PERFORM public.china_doc_notificar_status(
    p_documento_id, p_decisao, _doc.status, _uid, _nome, p_parecer, p_projeto_id, p_tarefa_id
  );

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

-- 3) Estados intermediários passam a notificar
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

  PERFORM public.china_doc_notificar_status(
    p_documento_id, p_status, _doc.status, _uid, _nome, NULL, p_projeto_id, p_tarefa_id
  );

  RETURN jsonb_build_object('ok', true, 'status', p_status);
END;
$$;

-- 4) Aprovação em lote: um único step-up, uma trilha homologada por documento
CREATE OR REPLACE FUNCTION public.rpc_china_aprovar_documentos_lote(
  p_documento_ids uuid[],
  p_decisao text,
  p_step_up_token text,
  p_parecer text DEFAULT NULL,
  p_projeto_id uuid DEFAULT NULL,
  p_origem text DEFAULT 'kanban_lote',
  p_metodo text DEFAULT 'senha'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _nome text;
  _email text;
  _ok boolean;
  _doc RECORD;
  _tarefa_id uuid;
  _audit_id uuid;
  _resultados jsonb := '[]'::jsonb;
  _erros jsonb := '[]'::jsonb;
  _lote_id uuid := gen_random_uuid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada.' USING ERRCODE = '28000';
  END IF;
  IF p_decisao NOT IN ('aprovado','rejeitado') THEN
    RAISE EXCEPTION 'Decisão inválida para homologação: %', p_decisao;
  END IF;
  IF p_documento_ids IS NULL OR array_length(p_documento_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um documento.';
  END IF;
  IF array_length(p_documento_ids, 1) > 100 THEN
    RAISE EXCEPTION 'Limite de 100 documentos por lote.';
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

  SELECT nome, email INTO _nome, _email FROM public.profiles WHERE id = _uid;

  FOR _doc IN
    SELECT id, submissao_id, status, nome_arquivo, tipo_documento
    FROM public.china_produto_documentos
    WHERE id = ANY(p_documento_ids)
  LOOP
    BEGIN
      SELECT v.tarefa_id INTO _tarefa_id
      FROM public.china_documento_tarefa_vinculos v
      WHERE v.documento_id = _doc.id
      ORDER BY v.created_at DESC
      LIMIT 1;

      UPDATE public.china_produto_documentos
      SET status = p_decisao,
          observacoes_brasil = COALESCE(NULLIF(p_parecer, ''), observacoes_brasil)
      WHERE id = _doc.id;

      INSERT INTO public.china_doc_aprovacoes_audit (
        documento_id, submissao_id, tarefa_id, projeto_id, decisao, status_anterior,
        parecer, decidido_por, decidido_por_nome, decidido_por_email,
        metodo_confirmacao, origem
      ) VALUES (
        _doc.id, _doc.submissao_id, _tarefa_id, p_projeto_id, p_decisao, _doc.status,
        NULLIF(p_parecer, ''), _uid, _nome, _email, COALESCE(p_metodo, 'senha'),
        COALESCE(p_origem, 'kanban_lote') || ':' || _lote_id::text
      ) RETURNING id INTO _audit_id;

      PERFORM public.china_doc_notificar_status(
        _doc.id, p_decisao, _doc.status, _uid, _nome, p_parecer, p_projeto_id, _tarefa_id
      );

      _resultados := _resultados || jsonb_build_object(
        'documento_id', _doc.id,
        'audit_id', _audit_id,
        'label', COALESCE(NULLIF(_doc.nome_arquivo, ''), _doc.tipo_documento)
      );
    EXCEPTION WHEN OTHERS THEN
      _erros := _erros || jsonb_build_object('documento_id', _doc.id, 'erro', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'lote_id', _lote_id,
    'decisao', p_decisao,
    'processados', jsonb_array_length(_resultados),
    'falhas', jsonb_array_length(_erros),
    'resultados', _resultados,
    'erros', _erros
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_aprovar_documentos_lote(uuid[], text, text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_aprovar_documentos_lote(uuid[], text, text, text, uuid, text, text) TO authenticated;