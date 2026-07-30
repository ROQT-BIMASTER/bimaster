
-- 1) Backfill: grava a chave técnica do checklist nas tarefas dos projetos-espelho
WITH espelho AS (
  SELECT sp.submissao_id, sp.projeto_id
  FROM public.china_submissao_projetos sp
  WHERE sp.is_espelho = true
), candidatos AS (
  SELECT t.id AS tarefa_id, e.submissao_id, ci.tipo_key,
         row_number() OVER (PARTITION BY t.id ORDER BY ci.created_at) AS rn
  FROM espelho e
  JOIN public.projeto_tarefas t
    ON t.projeto_id = e.projeto_id
   AND t.tipo_tarefa = 'china_checklist_item'
   AND t.excluida_em IS NULL AND t.deleted_at IS NULL
   AND COALESCE(t.campos_customizados->>'china_tipo_key', '') = ''
  JOIN public.china_checklist_custom_itens ci
    ON ci.submissao_id = e.submissao_id
   AND public.china_norm_label(ci.label_pt) = public.china_norm_label(t.titulo)
)
UPDATE public.projeto_tarefas t
   SET campos_customizados = COALESCE(t.campos_customizados, '{}'::jsonb)
       || jsonb_build_object('china_tipo_key', c.tipo_key,
                             'china_submissao_id', c.submissao_id)
  FROM candidatos c
 WHERE c.rn = 1 AND t.id = c.tarefa_id;

WITH espelho AS (
  SELECT sp.submissao_id, sp.projeto_id
  FROM public.china_submissao_projetos sp
  WHERE sp.is_espelho = true
), candidatos AS (
  SELECT t.id AS tarefa_id, e.submissao_id, l.tipo_key,
         row_number() OVER (PARTITION BY t.id ORDER BY l.tipo_key) AS rn
  FROM espelho e
  JOIN public.projeto_tarefas t
    ON t.projeto_id = e.projeto_id
   AND t.tipo_tarefa = 'china_checklist_item'
   AND t.excluida_em IS NULL AND t.deleted_at IS NULL
   AND COALESCE(t.campos_customizados->>'china_tipo_key', '') = ''
  JOIN public.china_document_type_labels l
    ON public.china_norm_label(l.label_pt) = public.china_norm_label(t.titulo)
)
UPDATE public.projeto_tarefas t
   SET campos_customizados = COALESCE(t.campos_customizados, '{}'::jsonb)
       || jsonb_build_object('china_tipo_key', c.tipo_key,
                             'china_submissao_id', c.submissao_id)
  FROM candidatos c
 WHERE c.rn = 1 AND t.id = c.tarefa_id;

-- 2) Sincronização: seção própria para itens do Cofre, agrupamento por tipo
CREATE OR REPLACE FUNCTION public.rpc_china_sincronizar_documentos_projeto(
  p_submissao_id uuid, p_documento_id uuid DEFAULT NULL::uuid, p_actor uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto_id uuid;
  v_user uuid;
  v_doc record;
  v_tarefa_id uuid;
  v_secao_id uuid;
  v_secao_nome text;
  v_secao_ordem int;
  v_ordem int;
  v_path text;
  v_label text;
  v_prazo int;
  v_data_inicio date;
  v_vinculados int := 0;
  v_tarefas_criadas int := 0;
BEGIN
  IF p_submissao_id IS NULL THEN
    RETURN jsonb_build_object('projeto_id', NULL, 'vinculados', 0, 'tarefas_criadas', 0);
  END IF;

  SELECT projeto_id INTO v_projeto_id
  FROM public.china_submissao_projetos
  WHERE submissao_id = p_submissao_id AND is_espelho = true
  LIMIT 1;

  IF v_projeto_id IS NULL THEN
    RETURN jsonb_build_object('projeto_id', NULL, 'vinculados', 0, 'tarefas_criadas', 0);
  END IF;

  SELECT criador_id, COALESCE(prazo_padrao_tarefa, 5), COALESCE(data_inicio, current_date)
    INTO v_user, v_prazo, v_data_inicio
  FROM public.projetos WHERE id = v_projeto_id;

  v_user := COALESCE(auth.uid(), p_actor, v_user);
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('projeto_id', v_projeto_id, 'vinculados', 0, 'tarefas_criadas', 0);
  END IF;

  FOR v_doc IN
    SELECT d.id, d.nome_arquivo, d.arquivo_path, d.arquivo_url, d.tipo_documento,
           d.observacao, d.status, d.cofre_item_id
    FROM public.china_produto_documentos d
    WHERE d.submissao_id = p_submissao_id
      AND (p_documento_id IS NULL OR d.id = p_documento_id)
      AND NULLIF(trim(COALESCE(d.arquivo_path, '')), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.china_documento_tarefa_vinculos v
        WHERE v.documento_id = d.id AND v.projeto_id = v_projeto_id
      )
    ORDER BY d.created_at
  LOOP
    v_path := trim(v_doc.arquivo_path);
    v_label := public.china_doc_label(p_submissao_id, v_doc.tipo_documento, v_doc.cofre_item_id);

    v_tarefa_id := public.fn_china_resolver_tarefa_documento(
      p_submissao_id, v_projeto_id, v_doc.tipo_documento, v_doc.cofre_item_id);

    -- Sem correspondência no checklist: agrupa por tipo em seção dedicada
    IF v_tarefa_id IS NULL THEN
      v_secao_nome := CASE
        WHEN v_doc.cofre_item_id IS NOT NULL OR v_doc.tipo_documento ~ '^cofre_'
        THEN 'Cofre do Produto' ELSE 'Outros documentos' END;

      SELECT id INTO v_secao_id
      FROM public.projeto_secoes
      WHERE projeto_id = v_projeto_id AND nome = v_secao_nome LIMIT 1;

      IF v_secao_id IS NULL THEN
        SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_secao_ordem
        FROM public.projeto_secoes WHERE projeto_id = v_projeto_id;
        INSERT INTO public.projeto_secoes (projeto_id, nome, ordem)
        VALUES (v_projeto_id, v_secao_nome, COALESCE(v_secao_ordem, 1))
        RETURNING id INTO v_secao_id;
      END IF;

      SELECT t.id INTO v_tarefa_id
      FROM public.projeto_tarefas t
      WHERE t.projeto_id = v_projeto_id
        AND t.excluida_em IS NULL AND t.deleted_at IS NULL
        AND (
          t.campos_customizados->>'china_tipo_key' = v_doc.tipo_documento
          OR public.china_norm_label(t.titulo) = public.china_norm_label(v_label)
        )
      ORDER BY t.ordem LIMIT 1;

      IF v_tarefa_id IS NULL THEN
        SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem
        FROM public.projeto_tarefas
        WHERE projeto_id = v_projeto_id AND secao_id = v_secao_id;

        INSERT INTO public.projeto_tarefas (
          projeto_id, secao_id, titulo, descricao, status,
          criador_id, canal_criacao, tipo_tarefa, ordem, data_prazo, campos_customizados
        ) VALUES (
          v_projeto_id, v_secao_id, v_label,
          COALESCE(v_doc.observacao, ''),
          CASE v_doc.status WHEN 'aprovado' THEN 'concluida'
                            WHEN 'rejeitado' THEN 'em_andamento'
                            ELSE 'pendente' END,
          v_user, 'china_submissao', 'china_documento', COALESCE(v_ordem, 1),
          (v_data_inicio + v_prazo)::date,
          jsonb_build_object('china_tipo_key', v_doc.tipo_documento,
                             'china_submissao_id', p_submissao_id)
        )
        RETURNING id INTO v_tarefa_id;
        v_tarefas_criadas := v_tarefas_criadas + 1;
      END IF;
    END IF;

    INSERT INTO public.projeto_tarefa_anexos (
      tarefa_id, user_id, nome, storage_path, tipo_arquivo, metadata
    )
    SELECT v_tarefa_id, v_user,
           COALESCE(v_doc.nome_arquivo, v_label, 'documento'),
           v_path, v_doc.tipo_documento,
           jsonb_build_object(
             'origem','china_submissao',
             'submissao_id', p_submissao_id,
             'china_documento_id', v_doc.id,
             'arquivo_url', v_doc.arquivo_url,
             'bucket', 'china-documentos')
    WHERE NOT EXISTS (
      SELECT 1 FROM public.projeto_tarefa_anexos a
      WHERE a.tarefa_id = v_tarefa_id
        AND a.metadata->>'china_documento_id' = v_doc.id::text);

    UPDATE public.china_produto_documentos
      SET projeto_tarefa_id = COALESCE(projeto_tarefa_id, v_tarefa_id)
      WHERE id = v_doc.id;

    INSERT INTO public.china_documento_tarefa_vinculos
      (documento_id, tarefa_id, secao_id, projeto_id, created_by)
    SELECT v_doc.id, v_tarefa_id, t.secao_id, v_projeto_id, v_user
    FROM public.projeto_tarefas t WHERE t.id = v_tarefa_id
    ON CONFLICT (documento_id, tarefa_id) DO NOTHING;

    v_vinculados := v_vinculados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'projeto_id', v_projeto_id,
    'vinculados', v_vinculados,
    'tarefas_criadas', v_tarefas_criadas);
END;
$function$;

-- 3) Reparo: move, consolida duplicadas, renomeia títulos técnicos e arquiva vazias
CREATE OR REPLACE FUNCTION public.rpc_china_reparar_documentos_projeto(p_submissao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto_id uuid;
  v_user uuid := auth.uid();
  v_doc record;
  v_dup record;
  v_alvo uuid;
  v_movidos int := 0;
  v_arquivadas int := 0;
  v_consolidadas int := 0;
  v_renomeadas int := 0;
  v_sync jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

  SELECT projeto_id INTO v_projeto_id
  FROM public.china_submissao_projetos
  WHERE submissao_id = p_submissao_id AND is_espelho = true LIMIT 1;

  IF v_projeto_id IS NULL THEN
    RETURN jsonb_build_object('projeto_id', NULL, 'movidos', 0, 'arquivadas', 0, 'vinculados', 0);
  END IF;

  -- 3.1 move documentos para a tarefa/seção correta do checklist
  FOR v_doc IN
    SELECT d.id, d.tipo_documento, d.cofre_item_id, d.projeto_tarefa_id
    FROM public.china_produto_documentos d
    WHERE d.submissao_id = p_submissao_id
      AND NULLIF(trim(COALESCE(d.arquivo_path, '')), '') IS NOT NULL
    ORDER BY d.created_at
  LOOP
    v_alvo := public.fn_china_resolver_tarefa_documento(
      p_submissao_id, v_projeto_id, v_doc.tipo_documento, v_doc.cofre_item_id);

    IF v_alvo IS NULL OR v_alvo = v_doc.projeto_tarefa_id THEN
      CONTINUE;
    END IF;

    UPDATE public.projeto_tarefa_anexos a
      SET tarefa_id = v_alvo
      WHERE a.metadata->>'china_documento_id' = v_doc.id::text
        AND a.tarefa_id IS DISTINCT FROM v_alvo
        AND NOT EXISTS (
          SELECT 1 FROM public.projeto_tarefa_anexos b
          WHERE b.tarefa_id = v_alvo
            AND b.metadata->>'china_documento_id' = v_doc.id::text);

    DELETE FROM public.projeto_tarefa_anexos a
      WHERE a.metadata->>'china_documento_id' = v_doc.id::text
        AND a.tarefa_id <> v_alvo;

    DELETE FROM public.china_documento_tarefa_vinculos v
      WHERE v.documento_id = v_doc.id AND v.projeto_id = v_projeto_id
        AND v.tarefa_id <> v_alvo;

    INSERT INTO public.china_documento_tarefa_vinculos
      (documento_id, tarefa_id, secao_id, projeto_id, created_by)
    SELECT v_doc.id, v_alvo, t.secao_id, v_projeto_id, v_user
    FROM public.projeto_tarefas t WHERE t.id = v_alvo
    ON CONFLICT (documento_id, tarefa_id) DO NOTHING;

    UPDATE public.china_produto_documentos
      SET projeto_tarefa_id = v_alvo WHERE id = v_doc.id;

    v_movidos := v_movidos + 1;
  END LOOP;

  -- 3.2 consolida tarefas automáticas duplicadas do mesmo tipo
  FOR v_dup IN
    SELECT campos_customizados->>'china_tipo_key' AS tipo_key,
           (array_agg(id ORDER BY ordem, created_at))[1] AS manter,
           array_agg(id ORDER BY ordem, created_at) AS todas
    FROM public.projeto_tarefas
    WHERE projeto_id = v_projeto_id
      AND tipo_tarefa = 'china_documento'
      AND canal_criacao = 'china_submissao'
      AND excluida_em IS NULL AND deleted_at IS NULL
      AND COALESCE(campos_customizados->>'china_tipo_key', '') <> ''
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    UPDATE public.projeto_tarefa_anexos a
      SET tarefa_id = v_dup.manter
      WHERE a.tarefa_id = ANY(v_dup.todas)
        AND a.tarefa_id <> v_dup.manter
        AND NOT EXISTS (
          SELECT 1 FROM public.projeto_tarefa_anexos b
          WHERE b.tarefa_id = v_dup.manter
            AND b.metadata->>'china_documento_id' = a.metadata->>'china_documento_id');

    DELETE FROM public.projeto_tarefa_anexos a
      WHERE a.tarefa_id = ANY(v_dup.todas) AND a.tarefa_id <> v_dup.manter;

    UPDATE public.china_documento_tarefa_vinculos v
      SET tarefa_id = v_dup.manter,
          secao_id = (SELECT secao_id FROM public.projeto_tarefas WHERE id = v_dup.manter)
      WHERE v.tarefa_id = ANY(v_dup.todas)
        AND v.tarefa_id <> v_dup.manter
        AND NOT EXISTS (
          SELECT 1 FROM public.china_documento_tarefa_vinculos w
          WHERE w.documento_id = v.documento_id AND w.tarefa_id = v_dup.manter);

    DELETE FROM public.china_documento_tarefa_vinculos v
      WHERE v.tarefa_id = ANY(v_dup.todas) AND v.tarefa_id <> v_dup.manter;

    UPDATE public.china_produto_documentos d
      SET projeto_tarefa_id = v_dup.manter
      WHERE d.projeto_tarefa_id = ANY(v_dup.todas) AND d.projeto_tarefa_id <> v_dup.manter;

    UPDATE public.projeto_tarefas t
      SET excluida_em = now(), excluida_por = v_user
      WHERE t.id = ANY(v_dup.todas) AND t.id <> v_dup.manter
        AND t.excluida_em IS NULL;

    v_consolidadas := v_consolidadas + array_length(v_dup.todas, 1) - 1;
  END LOOP;

  -- 3.3 renomeia títulos técnicos para o rótulo legível
  UPDATE public.projeto_tarefas t
     SET titulo = public.china_doc_label(p_submissao_id, t.campos_customizados->>'china_tipo_key')
   WHERE t.projeto_id = v_projeto_id
     AND t.canal_criacao = 'china_submissao'
     AND t.excluida_em IS NULL AND t.deleted_at IS NULL
     AND COALESCE(t.campos_customizados->>'china_tipo_key', '') <> ''
     AND public.china_norm_label(t.titulo)
         = public.china_norm_label(t.campos_customizados->>'china_tipo_key')
     AND public.china_norm_label(
           public.china_doc_label(p_submissao_id, t.campos_customizados->>'china_tipo_key'))
         <> public.china_norm_label(t.titulo);
  GET DIAGNOSTICS v_renomeadas = ROW_COUNT;

  -- 3.4 arquiva tarefas automáticas que ficaram vazias
  WITH orfas AS (
    SELECT t.id
    FROM public.projeto_tarefas t
    WHERE t.projeto_id = v_projeto_id
      AND t.tipo_tarefa = 'china_documento'
      AND t.canal_criacao = 'china_submissao'
      AND t.excluida_em IS NULL AND t.deleted_at IS NULL
      AND t.responsavel_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.projeto_tarefa_anexos a WHERE a.tarefa_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM public.china_documento_tarefa_vinculos v WHERE v.tarefa_id = t.id)
      AND NOT EXISTS (SELECT 1 FROM public.projeto_tarefas s WHERE s.parent_tarefa_id = t.id AND s.excluida_em IS NULL)
  )
  UPDATE public.projeto_tarefas t
     SET excluida_em = now(), excluida_por = v_user
    FROM orfas o WHERE t.id = o.id;
  GET DIAGNOSTICS v_arquivadas = ROW_COUNT;

  v_sync := public.rpc_china_sincronizar_documentos_projeto(p_submissao_id, NULL, v_user);

  RETURN jsonb_build_object(
    'projeto_id', v_projeto_id,
    'movidos', v_movidos,
    'consolidadas', v_consolidadas,
    'renomeadas', v_renomeadas,
    'arquivadas', v_arquivadas,
    'vinculados', COALESCE((v_sync->>'vinculados')::int, 0));
END;
$function$;
