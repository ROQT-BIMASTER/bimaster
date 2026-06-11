
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

    INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
    VALUES (v_projeto_id, v_user, 'coordenador')
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO public.china_submissao_projetos (submissao_id, projeto_id, is_espelho, created_by)
  VALUES (p_submissao_id, v_projeto_id, true, v_user)
  ON CONFLICT (submissao_id, projeto_id) DO UPDATE
    SET is_espelho = true;

  SELECT id INTO v_secao_id
  FROM public.projeto_secoes
  WHERE projeto_id = v_projeto_id AND nome = p_secao_nome
  LIMIT 1;

  IF v_secao_id IS NULL THEN
    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem)
    VALUES (v_projeto_id, p_secao_nome, 0)
    RETURNING id INTO v_secao_id;
  END IF;

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
