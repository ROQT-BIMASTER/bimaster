
-- =========================================================
-- 1) rpc_china_criar_projeto_espelho
-- Cria ou vincula projeto-espelho para uma submissão China.
-- =========================================================
CREATE OR REPLACE FUNCTION public.rpc_china_criar_projeto_espelho(
  p_submissao_id uuid,
  p_projeto_id uuid DEFAULT NULL,
  p_template_b2c_id uuid DEFAULT NULL,
  p_secao_nome text DEFAULT 'Documentos da Submissão',
  p_projeto_nome text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_subm record;
  v_projeto_id uuid;
  v_secao_id uuid;
  v_doc record;
  v_tarefa_id uuid;
  v_item jsonb;
  v_already_espelho uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_subm
  FROM public.china_produto_submissoes
  WHERE id = p_submissao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'submissao não encontrada' USING ERRCODE = '22023';
  END IF;

  -- Se já existe espelho para essa submissão, retorna o existente.
  SELECT projeto_id INTO v_already_espelho
  FROM public.china_submissao_projetos
  WHERE submissao_id = p_submissao_id AND is_espelho = true
  LIMIT 1;

  IF v_already_espelho IS NOT NULL THEN
    RETURN jsonb_build_object(
      'projeto_id', v_already_espelho,
      'submissao_id', p_submissao_id,
      'created', false,
      'already_existed', true
    );
  END IF;

  -- 1a) Reusar projeto existente OU criar novo
  IF p_projeto_id IS NOT NULL THEN
    SELECT id INTO v_projeto_id FROM public.projetos WHERE id = p_projeto_id;
    IF v_projeto_id IS NULL THEN
      RAISE EXCEPTION 'projeto não encontrado' USING ERRCODE = '22023';
    END IF;
  ELSE
    INSERT INTO public.projetos (
      nome, descricao, cor, icone, status, visibilidade, tipo, criador_id, origem_projeto
    ) VALUES (
      COALESCE(NULLIF(trim(p_projeto_nome), ''),
               'Submissão ' || COALESCE(v_subm.produto_codigo, substr(p_submissao_id::text, 1, 8))),
      'Projeto-espelho da submissão ' || COALESCE(v_subm.produto_codigo, p_submissao_id::text),
      '#E91E78',
      'Package',
      'ativo',
      'equipe',
      'china_submissao',
      v_user,
      'china_submissao'
    )
    RETURNING id INTO v_projeto_id;

    -- Adiciona criador como membro (pré-requisito de visibilidade)
    BEGIN
      INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
      VALUES (v_projeto_id, v_user, 'admin')
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN undefined_column THEN
      INSERT INTO public.projeto_membros (projeto_id, user_id)
      VALUES (v_projeto_id, v_user) ON CONFLICT DO NOTHING;
    END;
  END IF;

  -- 2) Marca vínculo como espelho (ou cria)
  INSERT INTO public.china_submissao_projetos (submissao_id, projeto_id, is_espelho, created_by)
  VALUES (p_submissao_id, v_projeto_id, true, v_user)
  ON CONFLICT (submissao_id, projeto_id) DO UPDATE
    SET is_espelho = true;

  -- 3) Cria/recupera seção "Documentos da Submissão"
  SELECT id INTO v_secao_id
  FROM public.projeto_secoes
  WHERE projeto_id = v_projeto_id AND nome = p_secao_nome
  LIMIT 1;

  IF v_secao_id IS NULL THEN
    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem)
    VALUES (v_projeto_id, p_secao_nome, 0)
    RETURNING id INTO v_secao_id;
  END IF;

  -- 4) Para cada doc da submissão já enviado, cria tarefa-espelho (se ainda não houver)
  FOR v_doc IN
    SELECT d.*
    FROM public.china_produto_documentos d
    WHERE d.submissao_id = p_submissao_id
      AND d.status IN ('enviado_brasil','enviado_parcial','em_revisao','aprovado','rejeitado','pendente')
      AND d.projeto_tarefa_id IS NULL
  LOOP
    INSERT INTO public.projeto_tarefas (
      projeto_id, secao_id, titulo, descricao, status, criador_id, canal_criacao, tipo_tarefa
    ) VALUES (
      v_projeto_id,
      v_secao_id,
      COALESCE(v_doc.tipo_documento, 'Documento'),
      COALESCE(v_doc.observacao, ''),
      CASE v_doc.status
        WHEN 'aprovado' THEN 'concluida'
        WHEN 'rejeitado' THEN 'em_andamento'
        ELSE 'pendente'
      END,
      v_user,
      'china_submissao',
      'china_documento'
    )
    RETURNING id INTO v_tarefa_id;

    UPDATE public.china_produto_documentos
      SET projeto_tarefa_id = v_tarefa_id
      WHERE id = v_doc.id;
  END LOOP;

  -- 5) Popular checklist B→C a partir de template (opcional)
  IF p_template_b2c_id IS NOT NULL THEN
    FOR v_item IN
      SELECT jsonb_array_elements(itens)
      FROM public.china_checklist_brasil_china_templates
      WHERE id = p_template_b2c_id
    LOOP
      INSERT INTO public.china_checklist_brasil_china (
        submissao_id, template_id, categoria, nome_documento, descricao,
        obrigatorio, sla_dias, status, created_by
      ) VALUES (
        p_submissao_id,
        p_template_b2c_id,
        COALESCE(v_item->>'categoria', 'Geral'),
        COALESCE(v_item->>'nome_documento', 'Documento'),
        v_item->>'descricao',
        COALESCE((v_item->>'obrigatorio')::boolean, true),
        NULLIF((v_item->>'sla_dias'), '')::integer,
        'pendente',
        v_user
      );
    END LOOP;
  END IF;

  -- 6) Evento de timeline
  BEGIN
    INSERT INTO public.china_timeline_eventos (
      kind, title, descricao, submissao_id, payload, actor_label
    ) VALUES (
      'projeto_espelho_criado',
      'Projeto-espelho criado',
      'Submissão vinculada ao projeto ' || v_projeto_id::text,
      p_submissao_id,
      jsonb_build_object('projeto_id', v_projeto_id, 'template_b2c_id', p_template_b2c_id),
      'brasil'
    );
  EXCEPTION WHEN OTHERS THEN
    -- timeline é best-effort
    NULL;
  END;

  RETURN jsonb_build_object(
    'projeto_id', v_projeto_id,
    'submissao_id', p_submissao_id,
    'secao_id', v_secao_id,
    'created', true,
    'already_existed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_criar_projeto_espelho(uuid, uuid, uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_china_criar_projeto_espelho(uuid, uuid, uuid, text, text) TO authenticated;

-- =========================================================
-- 2) rpc_china_enviar_doc_b2c
-- Marca um item B→C como enviado à China.
-- =========================================================
CREATE OR REPLACE FUNCTION public.rpc_china_enviar_doc_b2c(p_item_id uuid)
RETURNS public.china_checklist_brasil_china
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.china_checklist_brasil_china;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.china_checklist_brasil_china WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item não encontrado' USING ERRCODE = '22023';
  END IF;
  IF v_row.arquivo_path IS NULL THEN
    RAISE EXCEPTION 'anexe um arquivo antes de enviar' USING ERRCODE = '22023';
  END IF;

  UPDATE public.china_checklist_brasil_china
  SET status = 'enviado_china',
      enviado_em = now(),
      motivo_devolucao = NULL
  WHERE id = p_item_id
  RETURNING * INTO v_row;

  BEGIN
    INSERT INTO public.china_timeline_eventos (kind, title, descricao, submissao_id, payload, actor_label)
    VALUES ('doc_b2c_enviado', 'Documento enviado à China', v_row.nome_documento, v_row.submissao_id,
            jsonb_build_object('item_id', p_item_id), 'brasil');
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_enviar_doc_b2c(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_china_enviar_doc_b2c(uuid) TO authenticated;

-- =========================================================
-- 3) rpc_china_responder_doc_b2c
-- Resposta da China: aprovado ou devolvido (com motivo).
-- =========================================================
CREATE OR REPLACE FUNCTION public.rpc_china_responder_doc_b2c(
  p_item_id uuid,
  p_decisao text,
  p_motivo text DEFAULT NULL
)
RETURNS public.china_checklist_brasil_china
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.china_checklist_brasil_china;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;
  IF p_decisao NOT IN ('aprovado','devolvido') THEN
    RAISE EXCEPTION 'decisão inválida' USING ERRCODE = '22023';
  END IF;
  IF p_decisao = 'devolvido' AND (p_motivo IS NULL OR length(trim(p_motivo)) < 5) THEN
    RAISE EXCEPTION 'motivo obrigatório (mínimo 5 caracteres)' USING ERRCODE = '22023';
  END IF;

  UPDATE public.china_checklist_brasil_china
  SET status = CASE p_decisao WHEN 'aprovado' THEN 'aprovado_china' ELSE 'devolvido_china' END,
      motivo_devolucao = CASE p_decisao WHEN 'devolvido' THEN p_motivo ELSE NULL END,
      recebido_em = COALESCE(recebido_em, now()),
      respondido_em = now(),
      respondido_por = v_user
  WHERE id = p_item_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'item não encontrado' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.china_timeline_eventos (kind, title, descricao, submissao_id, payload, actor_label)
    VALUES (
      CASE p_decisao WHEN 'aprovado' THEN 'doc_b2c_aprovado' ELSE 'doc_b2c_devolvido' END,
      CASE p_decisao WHEN 'aprovado' THEN 'Documento aprovado pela China' ELSE 'Documento devolvido pela China' END,
      v_row.nome_documento || COALESCE(' — ' || p_motivo, ''),
      v_row.submissao_id,
      jsonb_build_object('item_id', p_item_id, 'motivo', p_motivo),
      'china'
    );
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_china_responder_doc_b2c(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_china_responder_doc_b2c(uuid, text, text) TO authenticated;
