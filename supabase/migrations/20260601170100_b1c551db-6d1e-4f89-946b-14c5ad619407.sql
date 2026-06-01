-- =================================================================
-- Arquivar anexo do chat nos cofres oficiais
-- =================================================================

-- Tabela de auditoria/dedupe para arquivamentos de anexos comuns do chat
CREATE TABLE IF NOT EXISTS public.chat_anexo_arquivamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anexo_id UUID NOT NULL REFERENCES public.mensagens_anexos(id) ON DELETE CASCADE,
  conversa_id UUID NOT NULL,
  destino_tipo TEXT NOT NULL CHECK (destino_tipo IN ('china_checklist','briefing','projeto','tarefa')),
  submissao_id UUID,
  tipo_documento TEXT,
  briefing_id UUID,
  projeto_id UUID,
  tarefa_id UUID,
  categoria_cofre TEXT,
  bucket_destino TEXT NOT NULL,
  storage_path_destino TEXT NOT NULL,
  registro_destino_id UUID NOT NULL,
  arquivado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chat_anexo_arquivamentos TO authenticated;
GRANT ALL ON public.chat_anexo_arquivamentos TO service_role;

ALTER TABLE public.chat_anexo_arquivamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arquiv_anexo_select_participantes"
ON public.chat_anexo_arquivamentos
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_participant_of_conversa(conversa_id, auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_arquiv_anexo_anexo ON public.chat_anexo_arquivamentos(anexo_id);
CREATE INDEX IF NOT EXISTS idx_arquiv_anexo_conversa ON public.chat_anexo_arquivamentos(conversa_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_arquiv_anexo_china
  ON public.chat_anexo_arquivamentos(anexo_id, submissao_id, tipo_documento)
  WHERE destino_tipo = 'china_checklist';
CREATE UNIQUE INDEX IF NOT EXISTS uq_arquiv_anexo_briefing
  ON public.chat_anexo_arquivamentos(anexo_id, briefing_id, categoria_cofre)
  WHERE destino_tipo = 'briefing';
CREATE UNIQUE INDEX IF NOT EXISTS uq_arquiv_anexo_projeto
  ON public.chat_anexo_arquivamentos(anexo_id, projeto_id, categoria_cofre)
  WHERE destino_tipo = 'projeto';
CREATE UNIQUE INDEX IF NOT EXISTS uq_arquiv_anexo_tarefa
  ON public.chat_anexo_arquivamentos(anexo_id, tarefa_id, categoria_cofre)
  WHERE destino_tipo = 'tarefa';

-- =================================================================
-- Helper: valida que o anexo existe e que o user é participante da conversa
-- =================================================================
CREATE OR REPLACE FUNCTION public._anexo_chat_validate(p_anexo_id UUID)
RETURNS TABLE(anexo_id UUID, conversa_id UUID, file_name TEXT, storage_path TEXT, mime_type TEXT, size_bytes BIGINT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.conversa_id, a.file_name, a.storage_path, a.mime_type, a.size_bytes
  FROM public.mensagens_anexos a
  WHERE a.id = p_anexo_id
    AND public.is_participant_of_conversa(a.conversa_id, auth.uid());
$$;

-- =================================================================
-- 1) Arquivar em PROJETO
-- =================================================================
CREATE OR REPLACE FUNCTION public.rpc_arquivar_anexo_chat_projeto(
  p_anexo_id UUID, p_projeto_id UUID, p_categoria TEXT,
  p_novo_arquivo_path TEXT, p_nome_arquivo TEXT, p_mime TEXT, p_size BIGINT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_anexo RECORD;
  v_existing UUID;
  v_cofre_doc_id UUID;
  v_arq_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_categoria IS NULL OR length(trim(p_categoria)) = 0 THEN
    RAISE EXCEPTION 'categoria_obrigatoria';
  END IF;

  SELECT * INTO v_anexo FROM public._anexo_chat_validate(p_anexo_id) LIMIT 1;
  IF v_anexo.anexo_id IS NULL THEN RAISE EXCEPTION 'anexo_nao_encontrado_ou_sem_acesso'; END IF;

  IF NOT public.user_can_access_projeto(v_uid, p_projeto_id) THEN
    RAISE EXCEPTION 'sem_acesso_projeto';
  END IF;

  SELECT id INTO v_existing FROM public.chat_anexo_arquivamentos
  WHERE destino_tipo = 'projeto' AND anexo_id = p_anexo_id
    AND projeto_id = p_projeto_id AND categoria_cofre = p_categoria
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.projeto_cofre_documentos
    (projeto_id, created_by, nome, categoria, status, storage_path, mime_type, tamanho_bytes)
  VALUES
    (p_projeto_id, v_uid, COALESCE(p_nome_arquivo,'documento'), p_categoria,
     'recebido', p_novo_arquivo_path, p_mime, p_size)
  RETURNING id INTO v_cofre_doc_id;

  INSERT INTO public.chat_anexo_arquivamentos
    (anexo_id, conversa_id, destino_tipo, projeto_id, categoria_cofre,
     bucket_destino, storage_path_destino, registro_destino_id, arquivado_por)
  VALUES
    (p_anexo_id, v_anexo.conversa_id, 'projeto', p_projeto_id, p_categoria,
     'projeto-anexos', p_novo_arquivo_path, v_cofre_doc_id, v_uid)
  RETURNING id INTO v_arq_id;

  BEGIN
    INSERT INTO public.mensagens (conversa_id, remetente_id, tipo, conteudo, metadata)
    VALUES (v_anexo.conversa_id, v_uid, 'sistema',
      'Documento arquivado no Cofre do Projeto.',
      jsonb_build_object('arquivamento_id', v_arq_id, 'destino', 'projeto',
                         'projeto_id', p_projeto_id, 'categoria', p_categoria,
                         'nome_arquivo', COALESCE(p_nome_arquivo,'documento')));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_arq_id;
END;
$$;

-- =================================================================
-- 2) Arquivar em TAREFA
-- =================================================================
CREATE OR REPLACE FUNCTION public.rpc_arquivar_anexo_chat_tarefa(
  p_anexo_id UUID, p_projeto_id UUID, p_tarefa_id UUID, p_categoria TEXT,
  p_novo_arquivo_path TEXT, p_nome_arquivo TEXT, p_mime TEXT, p_size BIGINT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_anexo RECORD;
  v_existing UUID;
  v_anexo_dest_id UUID;
  v_arq_id UUID;
  v_tarefa_ok BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_categoria IS NULL OR length(trim(p_categoria)) = 0 THEN
    RAISE EXCEPTION 'categoria_obrigatoria';
  END IF;

  SELECT * INTO v_anexo FROM public._anexo_chat_validate(p_anexo_id) LIMIT 1;
  IF v_anexo.anexo_id IS NULL THEN RAISE EXCEPTION 'anexo_nao_encontrado_ou_sem_acesso'; END IF;

  IF NOT public.user_can_access_projeto(v_uid, p_projeto_id) THEN
    RAISE EXCEPTION 'sem_acesso_projeto';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.projeto_tarefas t
    WHERE t.id = p_tarefa_id AND t.projeto_id = p_projeto_id
  ) INTO v_tarefa_ok;
  IF NOT v_tarefa_ok THEN RAISE EXCEPTION 'tarefa_invalida'; END IF;

  SELECT id INTO v_existing FROM public.chat_anexo_arquivamentos
  WHERE destino_tipo = 'tarefa' AND anexo_id = p_anexo_id
    AND tarefa_id = p_tarefa_id AND categoria_cofre = p_categoria
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.projeto_tarefa_anexos
    (tarefa_id, user_id, nome, storage_path, tipo_arquivo, tamanho, metadata)
  VALUES
    (p_tarefa_id, v_uid, COALESCE(p_nome_arquivo,'documento'),
     p_novo_arquivo_path, p_mime, p_size,
     jsonb_build_object('categoria_cofre', p_categoria, 'is_oficial_cofre', true,
                        'origem', 'chat_anexo', 'anexo_chat_id', p_anexo_id))
  RETURNING id INTO v_anexo_dest_id;

  INSERT INTO public.chat_anexo_arquivamentos
    (anexo_id, conversa_id, destino_tipo, projeto_id, tarefa_id, categoria_cofre,
     bucket_destino, storage_path_destino, registro_destino_id, arquivado_por)
  VALUES
    (p_anexo_id, v_anexo.conversa_id, 'tarefa', p_projeto_id, p_tarefa_id, p_categoria,
     'projeto-anexos', p_novo_arquivo_path, v_anexo_dest_id, v_uid)
  RETURNING id INTO v_arq_id;

  BEGIN
    INSERT INTO public.mensagens (conversa_id, remetente_id, tipo, conteudo, metadata)
    VALUES (v_anexo.conversa_id, v_uid, 'sistema',
      'Documento arquivado no Cofre da Tarefa.',
      jsonb_build_object('arquivamento_id', v_arq_id, 'destino', 'tarefa',
                         'projeto_id', p_projeto_id, 'tarefa_id', p_tarefa_id,
                         'categoria', p_categoria,
                         'nome_arquivo', COALESCE(p_nome_arquivo,'documento')));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_arq_id;
END;
$$;

-- =================================================================
-- 3) Arquivar em BRIEFING
-- =================================================================
CREATE OR REPLACE FUNCTION public.rpc_arquivar_anexo_chat_briefing(
  p_anexo_id UUID, p_briefing_id UUID, p_categoria TEXT,
  p_novo_arquivo_path TEXT, p_nome_arquivo TEXT, p_mime TEXT, p_size BIGINT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_anexo RECORD;
  v_existing UUID;
  v_briefing_doc_id UUID;
  v_arq_id UUID;
  v_is_member BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_categoria IS NULL OR length(trim(p_categoria)) = 0 THEN
    RAISE EXCEPTION 'categoria_obrigatoria';
  END IF;

  SELECT * INTO v_anexo FROM public._anexo_chat_validate(p_anexo_id) LIMIT 1;
  IF v_anexo.anexo_id IS NULL THEN RAISE EXCEPTION 'anexo_nao_encontrado_ou_sem_acesso'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.briefing_membros m
    WHERE m.briefing_id = p_briefing_id AND m.user_id = v_uid
  ) OR public.has_role(v_uid, 'admin'::app_role) INTO v_is_member;
  IF NOT v_is_member THEN RAISE EXCEPTION 'sem_acesso_briefing'; END IF;

  SELECT id INTO v_existing FROM public.chat_anexo_arquivamentos
  WHERE destino_tipo = 'briefing' AND anexo_id = p_anexo_id
    AND briefing_id = p_briefing_id AND categoria_cofre = p_categoria
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.briefing_documentos
    (briefing_id, categoria, nome, status, storage_path, mime_type, tamanho_bytes,
     origem, is_oficial, created_by)
  VALUES
    (p_briefing_id, p_categoria, COALESCE(p_nome_arquivo,'documento'),
     'recebido', p_novo_arquivo_path, p_mime, p_size,
     'chat', TRUE, v_uid)
  RETURNING id INTO v_briefing_doc_id;

  INSERT INTO public.chat_anexo_arquivamentos
    (anexo_id, conversa_id, destino_tipo, briefing_id, categoria_cofre,
     bucket_destino, storage_path_destino, registro_destino_id, arquivado_por)
  VALUES
    (p_anexo_id, v_anexo.conversa_id, 'briefing', p_briefing_id, p_categoria,
     'briefing-cofre', p_novo_arquivo_path, v_briefing_doc_id, v_uid)
  RETURNING id INTO v_arq_id;

  BEGIN
    INSERT INTO public.mensagens (conversa_id, remetente_id, tipo, conteudo, metadata)
    VALUES (v_anexo.conversa_id, v_uid, 'sistema',
      'Documento arquivado no Cofre do Briefing.',
      jsonb_build_object('arquivamento_id', v_arq_id, 'destino', 'briefing',
                         'briefing_id', p_briefing_id, 'categoria', p_categoria,
                         'nome_arquivo', COALESCE(p_nome_arquivo,'documento')));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_arq_id;
END;
$$;

-- =================================================================
-- 4) Arquivar em CHECKLIST CHINA
-- =================================================================
CREATE OR REPLACE FUNCTION public.rpc_arquivar_anexo_chat_china(
  p_anexo_id UUID, p_submissao_id UUID, p_tipo_documento TEXT,
  p_novo_arquivo_path TEXT, p_nome_arquivo TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_anexo RECORD;
  v_existing UUID;
  v_china_doc_id UUID;
  v_arq_id UUID;
  v_can BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_tipo_documento IS NULL OR length(trim(p_tipo_documento)) = 0 THEN
    RAISE EXCEPTION 'tipo_documento_obrigatorio';
  END IF;

  SELECT * INTO v_anexo FROM public._anexo_chat_validate(p_anexo_id) LIMIT 1;
  IF v_anexo.anexo_id IS NULL THEN RAISE EXCEPTION 'anexo_nao_encontrado_ou_sem_acesso'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.china_produto_submissoes s
    WHERE s.id = p_submissao_id
      AND ( s.created_by = v_uid
         OR public.has_role(v_uid, 'admin'::public.app_role)
         OR public.has_role(v_uid, 'supervisor'::public.app_role)
         OR public.check_user_access(v_uid, 'fabrica')
         OR public.check_user_access(v_uid, 'china')
      )
  ) INTO v_can;
  IF NOT v_can THEN RAISE EXCEPTION 'sem_acesso_submissao'; END IF;

  SELECT id INTO v_existing FROM public.chat_anexo_arquivamentos
  WHERE destino_tipo = 'china_checklist' AND anexo_id = p_anexo_id
    AND submissao_id = p_submissao_id AND tipo_documento = p_tipo_documento
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  INSERT INTO public.china_produto_documentos
    (submissao_id, tipo_documento, arquivo_path, nome_arquivo, status, observacao)
  VALUES
    (p_submissao_id, p_tipo_documento, p_novo_arquivo_path, COALESCE(p_nome_arquivo,'documento'),
     'recebido', 'Arquivado a partir de anexo do chat')
  RETURNING id INTO v_china_doc_id;

  INSERT INTO public.chat_anexo_arquivamentos
    (anexo_id, conversa_id, destino_tipo, submissao_id, tipo_documento,
     bucket_destino, storage_path_destino, registro_destino_id, arquivado_por)
  VALUES
    (p_anexo_id, v_anexo.conversa_id, 'china_checklist', p_submissao_id, p_tipo_documento,
     'china-documentos', p_novo_arquivo_path, v_china_doc_id, v_uid)
  RETURNING id INTO v_arq_id;

  BEGIN
    INSERT INTO public.mensagens (conversa_id, remetente_id, tipo, conteudo, metadata)
    VALUES (v_anexo.conversa_id, v_uid, 'sistema',
      'Documento arquivado no Cofre da Submissão China.',
      jsonb_build_object('arquivamento_id', v_arq_id, 'destino', 'china_checklist',
                         'submissao_id', p_submissao_id, 'tipo_documento', p_tipo_documento,
                         'nome_arquivo', COALESCE(p_nome_arquivo,'documento')));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_arq_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public._anexo_chat_validate(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arquivar_anexo_chat_projeto(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arquivar_anexo_chat_tarefa(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arquivar_anexo_chat_briefing(UUID, UUID, TEXT, TEXT, TEXT, TEXT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_arquivar_anexo_chat_china(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
