
-- =============================================================================
-- Fix arquivamento de documentos aprovados no cofre oficial
--   - listas acessíveis por RPC SECURITY DEFINER
--   - validação de acesso real ao destino (projeto/tarefa/submissão/briefing)
-- =============================================================================

-- 1) Listagens seguras para o wizard ------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_chat_vinculo_submissoes_china()
RETURNS TABLE (
  id              uuid,
  produto_codigo  text,
  produto_nome    text,
  status          text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  -- mesmas regras do SELECT em china_produto_submissoes
  IF NOT (
        public.has_role(v_uid, 'admin'::public.app_role)
     OR public.has_role(v_uid, 'supervisor'::public.app_role)
     OR public.check_user_access(v_uid, 'fabrica')
     OR public.check_user_access(v_uid, 'china')
  ) THEN
    -- ainda pode ver as próprias
    RETURN QUERY
    SELECT s.id, s.produto_codigo, s.produto_nome, s.status
      FROM public.china_produto_submissoes s
     WHERE s.created_by = v_uid
       AND s.deleted_at IS NULL
     ORDER BY s.created_at DESC
     LIMIT 300;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.id, s.produto_codigo, s.produto_nome, s.status
    FROM public.china_produto_submissoes s
   WHERE s.deleted_at IS NULL
   ORDER BY s.created_at DESC
   LIMIT 300;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_chat_vinculo_submissoes_china() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_chat_vinculo_submissoes_china() TO authenticated;


CREATE OR REPLACE FUNCTION public.rpc_chat_vinculo_tarefas_projeto(p_projeto_id uuid)
RETURNS TABLE (
  id      uuid,
  titulo  text,
  status  text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF NOT public.user_can_access_projeto(v_uid, p_projeto_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT t.id, t.titulo, t.status
    FROM public.projeto_tarefas t
   WHERE t.projeto_id = p_projeto_id
   ORDER BY t.created_at DESC
   LIMIT 500;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_chat_vinculo_tarefas_projeto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_chat_vinculo_tarefas_projeto(uuid) TO authenticated;


-- 2) Endurecer validações dos RPCs de vínculo ---------------------------------

-- China: exigir acesso real (criador, admin/supervisor, fabrica ou china)
CREATE OR REPLACE FUNCTION public.rpc_vincular_aprovacao_checklist_china(
  p_documento_id UUID,
  p_submissao_id UUID,
  p_tipo_documento TEXT,
  p_novo_arquivo_path TEXT,
  p_nome_arquivo TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_doc RECORD;
  v_existing UUID;
  v_china_doc_id UUID;
  v_vinc_id UUID;
  v_can BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_tipo_documento IS NULL OR length(trim(p_tipo_documento)) = 0 THEN
    RAISE EXCEPTION 'tipo_documento_obrigatorio';
  END IF;

  SELECT * INTO v_doc FROM public._aprov_vinc_validate_doc(p_documento_id) LIMIT 1;
  IF v_doc.documento_id IS NULL THEN
    RAISE EXCEPTION 'documento_nao_encontrado_ou_sem_acesso';
  END IF;

  -- acesso real à submissão China
  SELECT EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = p_submissao_id
      AND (
            s.created_by = v_uid
         OR public.has_role(v_uid, 'admin'::public.app_role)
         OR public.has_role(v_uid, 'supervisor'::public.app_role)
         OR public.check_user_access(v_uid, 'fabrica')
         OR public.check_user_access(v_uid, 'china')
      )
  ) INTO v_can;
  IF NOT v_can THEN RAISE EXCEPTION 'sem_acesso_submissao'; END IF;

  -- dedupe
  SELECT id INTO v_existing
  FROM public.chat_aprovacao_doc_vinculos
  WHERE destino_tipo = 'china_checklist'
    AND documento_id = p_documento_id
    AND submissao_id = p_submissao_id
    AND tipo_documento = p_tipo_documento
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.china_produto_documentos
    (submissao_id, tipo_documento, arquivo_path, nome_arquivo, status, observacao)
  VALUES
    (p_submissao_id, p_tipo_documento, p_novo_arquivo_path, COALESCE(p_nome_arquivo,'documento'),
     'recebido', 'Vinculado de aprovação do chat')
  RETURNING id INTO v_china_doc_id;

  INSERT INTO public.chat_aprovacao_doc_vinculos
    (aprovacao_id, documento_id, conversa_id, destino_tipo,
     submissao_id, tipo_documento,
     bucket_destino, storage_path_destino, registro_destino_id,
     hash_arquivo, vinculado_por)
  VALUES
    (v_doc.aprovacao_id, p_documento_id, v_doc.conversa_id, 'china_checklist',
     p_submissao_id, p_tipo_documento,
     'china-documentos', p_novo_arquivo_path, v_china_doc_id,
     v_doc.hash_arquivo, v_uid)
  RETURNING id INTO v_vinc_id;

  BEGIN
    INSERT INTO public.chat_mensagens (conversa_id, autor_id, tipo, conteudo, metadata)
    VALUES (v_doc.conversa_id, v_uid, 'sistema',
      'Documento aprovado arquivado no Cofre da Submissão China.',
      jsonb_build_object('vinculo_id', v_vinc_id, 'destino', 'china_checklist',
                         'submissao_id', p_submissao_id, 'tipo_documento', p_tipo_documento));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_vinc_id;
END;
$$;


-- Projeto: usar user_can_access_projeto (criador, membro, departamento, admin)
CREATE OR REPLACE FUNCTION public.rpc_vincular_aprovacao_projeto(
  p_documento_id UUID,
  p_projeto_id UUID,
  p_categoria TEXT,
  p_novo_arquivo_path TEXT,
  p_nome_arquivo TEXT,
  p_mime TEXT,
  p_size BIGINT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_doc RECORD;
  v_existing UUID;
  v_cofre_doc_id UUID;
  v_vinc_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_categoria IS NULL OR length(trim(p_categoria)) = 0 THEN
    RAISE EXCEPTION 'categoria_obrigatoria';
  END IF;

  SELECT * INTO v_doc FROM public._aprov_vinc_validate_doc(p_documento_id) LIMIT 1;
  IF v_doc.documento_id IS NULL THEN
    RAISE EXCEPTION 'documento_nao_encontrado_ou_sem_acesso';
  END IF;

  IF NOT public.user_can_access_projeto(v_uid, p_projeto_id) THEN
    RAISE EXCEPTION 'sem_acesso_projeto';
  END IF;

  SELECT id INTO v_existing
  FROM public.chat_aprovacao_doc_vinculos
  WHERE destino_tipo = 'projeto'
    AND documento_id = p_documento_id
    AND projeto_id = p_projeto_id
    AND categoria_cofre = p_categoria
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.projeto_cofre_documentos
    (projeto_id, created_by, nome, categoria, status, storage_path, mime_type, tamanho_bytes)
  VALUES
    (p_projeto_id, v_uid, COALESCE(p_nome_arquivo,'documento'), p_categoria,
     'recebido', p_novo_arquivo_path, p_mime, p_size)
  RETURNING id INTO v_cofre_doc_id;

  INSERT INTO public.chat_aprovacao_doc_vinculos
    (aprovacao_id, documento_id, conversa_id, destino_tipo,
     projeto_id, categoria_cofre,
     bucket_destino, storage_path_destino, registro_destino_id,
     hash_arquivo, vinculado_por)
  VALUES
    (v_doc.aprovacao_id, p_documento_id, v_doc.conversa_id, 'projeto',
     p_projeto_id, p_categoria,
     'projeto-anexos', p_novo_arquivo_path, v_cofre_doc_id,
     v_doc.hash_arquivo, v_uid)
  RETURNING id INTO v_vinc_id;

  BEGIN
    INSERT INTO public.chat_mensagens (conversa_id, autor_id, tipo, conteudo, metadata)
    VALUES (v_doc.conversa_id, v_uid, 'sistema',
      'Documento aprovado arquivado no Cofre do Projeto.',
      jsonb_build_object('vinculo_id', v_vinc_id, 'destino', 'projeto',
                         'projeto_id', p_projeto_id, 'categoria', p_categoria));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_vinc_id;
END;
$$;


-- Tarefa: validar acesso ao projeto e que a tarefa pertence a ele
CREATE OR REPLACE FUNCTION public.rpc_vincular_aprovacao_tarefa(
  p_documento_id UUID,
  p_projeto_id UUID,
  p_tarefa_id UUID,
  p_categoria TEXT,
  p_novo_arquivo_path TEXT,
  p_nome_arquivo TEXT,
  p_mime TEXT,
  p_size BIGINT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_doc RECORD;
  v_existing UUID;
  v_anexo_id UUID;
  v_vinc_id UUID;
  v_tarefa_ok BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_categoria IS NULL OR length(trim(p_categoria)) = 0 THEN
    RAISE EXCEPTION 'categoria_obrigatoria';
  END IF;

  SELECT * INTO v_doc FROM public._aprov_vinc_validate_doc(p_documento_id) LIMIT 1;
  IF v_doc.documento_id IS NULL THEN
    RAISE EXCEPTION 'documento_nao_encontrado_ou_sem_acesso';
  END IF;

  IF NOT public.user_can_access_projeto(v_uid, p_projeto_id) THEN
    RAISE EXCEPTION 'sem_acesso_projeto';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.projeto_tarefas t
    WHERE t.id = p_tarefa_id AND t.projeto_id = p_projeto_id
  ) INTO v_tarefa_ok;
  IF NOT v_tarefa_ok THEN RAISE EXCEPTION 'tarefa_invalida'; END IF;

  SELECT id INTO v_existing
  FROM public.chat_aprovacao_doc_vinculos
  WHERE destino_tipo = 'tarefa'
    AND documento_id = p_documento_id
    AND tarefa_id = p_tarefa_id
    AND categoria_cofre = p_categoria
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.projeto_tarefa_anexos
    (tarefa_id, user_id, nome, storage_path, tipo_arquivo, tamanho, metadata)
  VALUES
    (p_tarefa_id, v_uid, COALESCE(p_nome_arquivo,'documento'),
     p_novo_arquivo_path, p_mime, p_size,
     jsonb_build_object('categoria_cofre', p_categoria, 'is_oficial_cofre', true,
                        'origem', 'chat_aprovacao', 'documento_id', p_documento_id))
  RETURNING id INTO v_anexo_id;

  INSERT INTO public.chat_aprovacao_doc_vinculos
    (aprovacao_id, documento_id, conversa_id, destino_tipo,
     projeto_id, tarefa_id, categoria_cofre,
     bucket_destino, storage_path_destino, registro_destino_id,
     hash_arquivo, vinculado_por)
  VALUES
    (v_doc.aprovacao_id, p_documento_id, v_doc.conversa_id, 'tarefa',
     p_projeto_id, p_tarefa_id, p_categoria,
     'projeto-anexos', p_novo_arquivo_path, v_anexo_id,
     v_doc.hash_arquivo, v_uid)
  RETURNING id INTO v_vinc_id;

  BEGIN
    INSERT INTO public.chat_mensagens (conversa_id, autor_id, tipo, conteudo, metadata)
    VALUES (v_doc.conversa_id, v_uid, 'sistema',
      'Documento aprovado arquivado no Cofre da Tarefa.',
      jsonb_build_object('vinculo_id', v_vinc_id, 'destino', 'tarefa',
                         'projeto_id', p_projeto_id, 'tarefa_id', p_tarefa_id,
                         'categoria', p_categoria));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_vinc_id;
END;
$$;
