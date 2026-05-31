
-- =============================================================================
-- Vínculo de Documentos Aprovados aos Cofres Oficiais
-- =============================================================================
-- Permite que documentos aprovados via chat (chat_aprovacao_documentos) sejam
-- vinculados a um de 4 destinos oficiais (cada um com seu cofre):
--   1. Checklist de Submissão China  -> china_produto_documentos / china-documentos
--   2. Briefing                       -> briefing_documentos     / briefing-cofre
--   3. Projeto (raiz)                 -> projeto_cofre_documentos / projeto-anexos
--   4. Tarefa de Projeto              -> projeto_tarefa_anexos    / projeto-anexos
-- Em todos os casos a TABULAÇÃO (categoria/tipo) é obrigatória.
-- =============================================================================

-- 1) Tabela de auditoria/dedupe -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_aprovacao_doc_vinculos (
  id                    UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aprovacao_id          UUID NOT NULL REFERENCES public.chat_aprovacoes(id) ON DELETE CASCADE,
  documento_id          UUID NOT NULL REFERENCES public.chat_aprovacao_documentos(id) ON DELETE CASCADE,
  conversa_id           UUID NOT NULL,
  destino_tipo          TEXT NOT NULL CHECK (destino_tipo IN ('china_checklist','briefing','projeto','tarefa')),
  submissao_id          UUID,
  tipo_documento        TEXT,
  briefing_id           UUID,
  projeto_id            UUID,
  tarefa_id             UUID,
  categoria_cofre       TEXT,
  bucket_destino        TEXT NOT NULL,
  storage_path_destino  TEXT NOT NULL,
  registro_destino_id   UUID NOT NULL,
  hash_arquivo          TEXT,
  vinculado_por         UUID NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- dedupe por destino lógico
CREATE UNIQUE INDEX IF NOT EXISTS uq_aprov_vinc_china
  ON public.chat_aprovacao_doc_vinculos (documento_id, submissao_id, tipo_documento)
  WHERE destino_tipo = 'china_checklist';
CREATE UNIQUE INDEX IF NOT EXISTS uq_aprov_vinc_briefing
  ON public.chat_aprovacao_doc_vinculos (documento_id, briefing_id, categoria_cofre)
  WHERE destino_tipo = 'briefing';
CREATE UNIQUE INDEX IF NOT EXISTS uq_aprov_vinc_projeto
  ON public.chat_aprovacao_doc_vinculos (documento_id, projeto_id, categoria_cofre)
  WHERE destino_tipo = 'projeto';
CREATE UNIQUE INDEX IF NOT EXISTS uq_aprov_vinc_tarefa
  ON public.chat_aprovacao_doc_vinculos (documento_id, tarefa_id, categoria_cofre)
  WHERE destino_tipo = 'tarefa';

CREATE INDEX IF NOT EXISTS idx_aprov_vinc_doc        ON public.chat_aprovacao_doc_vinculos (documento_id);
CREATE INDEX IF NOT EXISTS idx_aprov_vinc_aprovacao  ON public.chat_aprovacao_doc_vinculos (aprovacao_id);

GRANT SELECT, INSERT ON public.chat_aprovacao_doc_vinculos TO authenticated;
GRANT ALL ON public.chat_aprovacao_doc_vinculos TO service_role;

ALTER TABLE public.chat_aprovacao_doc_vinculos ENABLE ROW LEVEL SECURITY;

-- SELECT: participantes da conversa de origem (ou admin)
CREATE POLICY "vinculos_select_participantes"
  ON public.chat_aprovacao_doc_vinculos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_participant_of_conversa(conversa_id, auth.uid())
  );

-- INSERT bloqueado para clients diretos: tudo passa pelas RPCs SECURITY DEFINER.
-- (sem policy de insert para authenticated)

-- 2) Helper interno ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._aprov_vinc_validate_doc(
  p_documento_id UUID
) RETURNS TABLE (
  documento_id UUID,
  aprovacao_id UUID,
  conversa_id  UUID,
  hash_arquivo TEXT,
  status_aprov TEXT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT
    d.id, d.aprovacao_id, d.conversa_id, d.hash_arquivo, a.status
  FROM public.chat_aprovacao_documentos d
  JOIN public.chat_aprovacoes a ON a.id = d.aprovacao_id
  WHERE d.id = p_documento_id
    AND a.status = 'aprovado'
    AND public.is_participant_of_conversa(d.conversa_id, v_uid);
END;
$$;

REVOKE ALL ON FUNCTION public._aprov_vinc_validate_doc(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._aprov_vinc_validate_doc(UUID) TO authenticated;

-- 3) RPC: vincular a Checklist de Submissão China ------------------------------
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_tipo_documento IS NULL OR length(trim(p_tipo_documento)) = 0 THEN
    RAISE EXCEPTION 'tipo_documento_obrigatorio';
  END IF;

  SELECT * INTO v_doc FROM public._aprov_vinc_validate_doc(p_documento_id) LIMIT 1;
  IF v_doc.documento_id IS NULL THEN
    RAISE EXCEPTION 'documento_nao_encontrado_ou_sem_acesso';
  END IF;

  -- dedupe
  SELECT id INTO v_existing
  FROM public.chat_aprovacao_doc_vinculos
  WHERE destino_tipo = 'china_checklist'
    AND documento_id = p_documento_id
    AND submissao_id = p_submissao_id
    AND tipo_documento = p_tipo_documento
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  -- valida submissão existe (RLS de china_produto_submissoes barra se sem acesso)
  PERFORM 1 FROM public.china_produto_submissoes WHERE id = p_submissao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'submissao_nao_encontrada'; END IF;

  -- cria documento no checklist
  INSERT INTO public.china_produto_documentos
    (submissao_id, tipo_documento, arquivo_path, nome_arquivo, status, observacao)
  VALUES
    (p_submissao_id, p_tipo_documento, p_novo_arquivo_path, COALESCE(p_nome_arquivo,'documento'),
     'recebido', 'Vinculado de aprovação do chat')
  RETURNING id INTO v_china_doc_id;

  -- registra vínculo
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

  -- mensagem de sistema na conversa origem
  BEGIN
    INSERT INTO public.chat_mensagens (conversa_id, autor_id, tipo, conteudo, metadata)
    VALUES (v_doc.conversa_id, v_uid, 'sistema',
      'Documento aprovado arquivado no Cofre da Submissão China.',
      jsonb_build_object('vinculo_id', v_vinc_id, 'destino', 'china_checklist',
                         'submissao_id', p_submissao_id, 'tipo_documento', p_tipo_documento));
  EXCEPTION WHEN OTHERS THEN NULL; -- não bloquear se schema mensagens diferir
  END;

  RETURN v_vinc_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_vincular_aprovacao_checklist_china(UUID,UUID,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_aprovacao_checklist_china(UUID,UUID,TEXT,TEXT,TEXT) TO authenticated;

-- 4) RPC: vincular a Briefing --------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_vincular_aprovacao_briefing(
  p_documento_id UUID,
  p_briefing_id UUID,
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
  v_briefing_doc_id UUID;
  v_vinc_id UUID;
  v_is_member BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_categoria IS NULL OR length(trim(p_categoria)) = 0 THEN
    RAISE EXCEPTION 'categoria_obrigatoria';
  END IF;

  SELECT * INTO v_doc FROM public._aprov_vinc_validate_doc(p_documento_id) LIMIT 1;
  IF v_doc.documento_id IS NULL THEN
    RAISE EXCEPTION 'documento_nao_encontrado_ou_sem_acesso';
  END IF;

  -- acesso ao briefing
  SELECT EXISTS (
    SELECT 1 FROM public.briefing_membros m
    WHERE m.briefing_id = p_briefing_id AND m.user_id = v_uid
  ) OR public.has_role(v_uid, 'admin'::app_role) INTO v_is_member;
  IF NOT v_is_member THEN RAISE EXCEPTION 'sem_acesso_briefing'; END IF;

  -- dedupe
  SELECT id INTO v_existing
  FROM public.chat_aprovacao_doc_vinculos
  WHERE destino_tipo = 'briefing'
    AND documento_id = p_documento_id
    AND briefing_id = p_briefing_id
    AND categoria_cofre = p_categoria
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

  INSERT INTO public.chat_aprovacao_doc_vinculos
    (aprovacao_id, documento_id, conversa_id, destino_tipo,
     briefing_id, categoria_cofre,
     bucket_destino, storage_path_destino, registro_destino_id,
     hash_arquivo, vinculado_por)
  VALUES
    (v_doc.aprovacao_id, p_documento_id, v_doc.conversa_id, 'briefing',
     p_briefing_id, p_categoria,
     'briefing-cofre', p_novo_arquivo_path, v_briefing_doc_id,
     v_doc.hash_arquivo, v_uid)
  RETURNING id INTO v_vinc_id;

  BEGIN
    INSERT INTO public.chat_mensagens (conversa_id, autor_id, tipo, conteudo, metadata)
    VALUES (v_doc.conversa_id, v_uid, 'sistema',
      'Documento aprovado arquivado no Cofre do Briefing.',
      jsonb_build_object('vinculo_id', v_vinc_id, 'destino', 'briefing',
                         'briefing_id', p_briefing_id, 'categoria', p_categoria));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_vinc_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_vincular_aprovacao_briefing(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_aprovacao_briefing(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT) TO authenticated;

-- 5) RPC: vincular ao Cofre do Projeto -----------------------------------------
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
  v_is_member BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_categoria IS NULL OR length(trim(p_categoria)) = 0 THEN
    RAISE EXCEPTION 'categoria_obrigatoria';
  END IF;

  SELECT * INTO v_doc FROM public._aprov_vinc_validate_doc(p_documento_id) LIMIT 1;
  IF v_doc.documento_id IS NULL THEN
    RAISE EXCEPTION 'documento_nao_encontrado_ou_sem_acesso';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.projeto_membros m
    WHERE m.projeto_id = p_projeto_id AND m.user_id = v_uid
  ) OR public.has_role(v_uid, 'admin'::app_role) INTO v_is_member;
  IF NOT v_is_member THEN RAISE EXCEPTION 'sem_acesso_projeto'; END IF;

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

REVOKE ALL ON FUNCTION public.rpc_vincular_aprovacao_projeto(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_aprovacao_projeto(UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT) TO authenticated;

-- 6) RPC: vincular a Tarefa de Projeto -----------------------------------------
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
  v_is_member BOOLEAN;
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

  -- acesso ao projeto
  SELECT EXISTS (
    SELECT 1 FROM public.projeto_membros m
    WHERE m.projeto_id = p_projeto_id AND m.user_id = v_uid
  ) OR public.has_role(v_uid, 'admin'::app_role) INTO v_is_member;
  IF NOT v_is_member THEN RAISE EXCEPTION 'sem_acesso_projeto'; END IF;

  -- tarefa pertence ao projeto
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

REVOKE ALL ON FUNCTION public.rpc_vincular_aprovacao_tarefa(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_aprovacao_tarefa(UUID,UUID,UUID,TEXT,TEXT,TEXT,TEXT,BIGINT) TO authenticated;
