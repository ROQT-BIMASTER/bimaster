-- =========================================================================
-- rpc_china_promover_anexo_ao_checklist
-- =========================================================================
--
-- Promove um anexo de uma mensagem do chat de submissão China para um
-- item oficial do checklist (`china_produto_documentos`).
--
-- Fluxo esperado (frontend faz a parte de arquivo + chama a RPC):
--   1. Frontend baixa o blob de `china-chat-anexos/<path>`.
--   2. Frontend faz upload em `china-documentos/<submissao_id>/<tipo>/<file>`.
--   3. Frontend chama esta RPC com o `p_novo_arquivo_path` gerado.
--   4. RPC:
--      a. Cria linha em `china_produto_documentos` com status='enviado'.
--      b. Atualiza o anexo original no `china_chat_mensagens.anexos`
--         jsonb adicionando `promovido_documento_id` (rastreabilidade).
--      c. Insere uma mensagem nova no chat anunciando a promoção, com
--         `ref_tipo='documento'` apontando para o novo doc.
--
-- Permissão: Brasil OU China (decisão de produto 2026-05-18). RLS de
-- `china_chat_mensagens` valida participação na submissão; aqui só
-- checamos que `auth.uid()` existe.

CREATE OR REPLACE FUNCTION public.rpc_china_promover_anexo_ao_checklist(
  p_mensagem_id        uuid,
  p_anexo_path         text,
  p_tipo_documento     text,
  p_novo_arquivo_path  text,
  p_novo_nome_arquivo  text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_submissao_id  uuid;
  v_anexos        jsonb;
  v_doc_id        uuid;
  v_user_nome     text;
  v_user_tipo     text;
  v_anexos_novo   jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_mensagem_id IS NULL OR p_anexo_path IS NULL OR p_tipo_documento IS NULL
     OR p_novo_arquivo_path IS NULL OR p_novo_nome_arquivo IS NULL THEN
    RAISE EXCEPTION 'parâmetros obrigatórios ausentes';
  END IF;

  -- 1) Carrega mensagem origem e anexos
  SELECT submissao_id, COALESCE(anexos, '[]'::jsonb)
    INTO v_submissao_id, v_anexos
  FROM china_chat_mensagens
  WHERE id = p_mensagem_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'mensagem não encontrada';
  END IF;

  -- 2) Cria documento oficial no checklist
  INSERT INTO china_produto_documentos (
    submissao_id, tipo_documento, arquivo_path, nome_arquivo, status
  ) VALUES (
    v_submissao_id, p_tipo_documento, p_novo_arquivo_path, p_novo_nome_arquivo, 'enviado'
  )
  RETURNING id INTO v_doc_id;

  -- 3) Atualiza anexo original marcando `promovido_documento_id`.
  --    Iteramos o jsonb e remontamos com o flag no item certo (match por path).
  SELECT jsonb_agg(
    CASE WHEN a->>'path' = p_anexo_path
      THEN a || jsonb_build_object('promovido_documento_id', v_doc_id::text)
      ELSE a
    END
  )
  INTO v_anexos_novo
  FROM jsonb_array_elements(v_anexos) AS a;

  UPDATE china_chat_mensagens
     SET anexos = COALESCE(v_anexos_novo, '[]'::jsonb)
   WHERE id = p_mensagem_id;

  -- 4) Detecta nome + lado (china/brasil) do usuário que promoveu
  SELECT
    COALESCE(p.nome, 'Usuário'),
    CASE WHEN lower(COALESCE(d.nome, '')) LIKE '%china%' THEN 'china' ELSE 'brasil' END
  INTO v_user_nome, v_user_tipo
  FROM profiles p
  LEFT JOIN departamentos d ON d.id = p.departamento_id
  WHERE p.id = v_uid;

  v_user_nome := COALESCE(v_user_nome, 'Usuário');
  v_user_tipo := COALESCE(v_user_tipo, 'brasil');

  -- 5) Cria mensagem no chat anunciando a promoção, com referência ao novo doc
  INSERT INTO china_chat_mensagens (
    submissao_id, usuario_id, usuario_nome, conteudo, tipo,
    ref_tipo, ref_id, ref_label
  ) VALUES (
    v_submissao_id,
    v_uid,
    v_user_nome,
    '📋 Promovi o documento *' || p_novo_nome_arquivo || '* ao checklist como **' || p_tipo_documento || '**',
    v_user_tipo,
    'documento',
    v_doc_id::text,
    p_novo_nome_arquivo
  );

  RETURN v_doc_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_china_promover_anexo_ao_checklist(uuid, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_china_promover_anexo_ao_checklist(uuid, text, text, text, text)
  TO authenticated;

COMMENT ON FUNCTION public.rpc_china_promover_anexo_ao_checklist IS
  'Promove anexo do chat (china_chat_mensagens.anexos) para item oficial do checklist
   (china_produto_documentos). Permissão Brasil+China. Insere msg de sistema no chat.';
