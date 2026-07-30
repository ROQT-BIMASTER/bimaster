
CREATE OR REPLACE FUNCTION public.rpc_china_reparar_documentos_projeto(
  p_submissao_id uuid, p_actor uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto_id uuid;
  v_user uuid;
  v_doc record;
  v_dup record;
  v_alvo uuid;
  v_movidos int := 0;
  v_arquivadas int := 0;
  v_consolidadas int := 0;
  v_renomeadas int := 0;
  v_sync jsonb;
BEGIN
  SELECT projeto_id INTO v_projeto_id
  FROM public.china_submissao_projetos
  WHERE submissao_id = p_submissao_id AND is_espelho = true LIMIT 1;

  IF v_projeto_id IS NULL THEN
    RETURN jsonb_build_object('projeto_id', NULL, 'movidos', 0, 'arquivadas', 0, 'vinculados', 0);
  END IF;

  SELECT COALESCE(auth.uid(), p_actor, p.criador_id) INTO v_user
  FROM public.projetos p WHERE p.id = v_projeto_id;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;

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
