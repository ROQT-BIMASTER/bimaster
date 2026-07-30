-- ============================================================
-- 1. Helpers de normalização e resolução de rótulos
-- ============================================================
CREATE OR REPLACE FUNCTION public.china_norm_label(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    lower(translate(coalesce(p,''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
    '[^a-z0-9]+','','g')
$$;

CREATE OR REPLACE FUNCTION public.china_tipo_slug(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT public.china_norm_label(
    CASE WHEN coalesce(p,'') ~ '^custom_[0-9]+_[A-Za-z0-9]+_'
      THEN regexp_replace(p, '^custom_[0-9]+_[A-Za-z0-9]+_', '')
      ELSE coalesce(p,'') END)
$$;

CREATE OR REPLACE FUNCTION public.china_doc_label(
  p_submissao_id uuid, p_tipo text, p_cofre_item_id uuid DEFAULT NULL
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(
    (SELECT ci.label_pt FROM public.china_checklist_custom_itens ci
      WHERE ci.submissao_id = p_submissao_id AND ci.tipo_key = p_tipo
        AND nullif(trim(ci.label_pt),'') IS NOT NULL LIMIT 1),
    (SELECT c.nome_pt FROM public.cofre_produto_config c
      WHERE c.id = coalesce(
        p_cofre_item_id,
        CASE WHEN p_tipo ~ '^cofre_[0-9a-fA-F-]{36}$'
             THEN substring(p_tipo from 7)::uuid ELSE NULL END) LIMIT 1),
    nullif(trim(p_tipo),''),
    'Documento'
  )
$$;

-- ============================================================
-- 2. Cascata de resolução documento -> tarefa do checklist
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_china_resolver_tarefa_documento(
  p_submissao_id uuid, p_projeto_id uuid, p_tipo text, p_cofre_item_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tarefa_id uuid;
  v_label text;
  v_slug text;
BEGIN
  IF p_projeto_id IS NULL THEN RETURN NULL; END IF;

  -- 1) chave técnica gravada na tarefa
  SELECT t.id INTO v_tarefa_id
  FROM public.projeto_tarefas t
  WHERE t.projeto_id = p_projeto_id
    AND t.tipo_tarefa = 'china_checklist_item'
    AND t.excluida_em IS NULL AND t.deleted_at IS NULL
    AND t.campos_customizados->>'china_tipo_key' = p_tipo
  ORDER BY t.ordem LIMIT 1;
  IF v_tarefa_id IS NOT NULL THEN RETURN v_tarefa_id; END IF;

  v_label := public.china_doc_label(p_submissao_id, p_tipo, p_cofre_item_id);
  v_slug  := public.china_tipo_slug(p_tipo);

  -- 2) rótulo resolvido x título da tarefa (normalizados)
  SELECT t.id INTO v_tarefa_id
  FROM public.projeto_tarefas t
  WHERE t.projeto_id = p_projeto_id
    AND t.tipo_tarefa = 'china_checklist_item'
    AND t.excluida_em IS NULL AND t.deleted_at IS NULL
    AND public.china_norm_label(t.titulo) = public.china_norm_label(v_label)
    AND public.china_norm_label(v_label) <> ''
  ORDER BY t.ordem LIMIT 1;
  IF v_tarefa_id IS NOT NULL THEN RETURN v_tarefa_id; END IF;

  -- 3) sufixo semântico de chaves custom
  IF v_slug <> '' THEN
    SELECT t.id INTO v_tarefa_id
    FROM public.projeto_tarefas t
    WHERE t.projeto_id = p_projeto_id
      AND t.tipo_tarefa = 'china_checklist_item'
      AND t.excluida_em IS NULL AND t.deleted_at IS NULL
      AND (
        public.china_norm_label(t.titulo) = v_slug
        OR public.china_tipo_slug(t.campos_customizados->>'china_tipo_key') = v_slug
      )
    ORDER BY t.ordem LIMIT 1;
    IF v_tarefa_id IS NOT NULL THEN RETURN v_tarefa_id; END IF;
  END IF;

  -- 4) rótulo do item do checklist da submissão cujo tipo_key casa pelo slug
  IF v_slug <> '' THEN
    SELECT t.id INTO v_tarefa_id
    FROM public.china_checklist_custom_itens ci
    JOIN public.projeto_tarefas t
      ON t.projeto_id = p_projeto_id
     AND t.tipo_tarefa = 'china_checklist_item'
     AND t.excluida_em IS NULL AND t.deleted_at IS NULL
     AND public.china_norm_label(t.titulo) = public.china_norm_label(ci.label_pt)
    WHERE ci.submissao_id = p_submissao_id
      AND public.china_tipo_slug(ci.tipo_key) = v_slug
    ORDER BY t.ordem LIMIT 1;
  END IF;

  RETURN v_tarefa_id;
END;
$$;

-- ============================================================
-- 3. Sincronização (fonte única de vínculo documento -> tarefa)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_china_sincronizar_documentos_projeto(
  p_submissao_id uuid, p_documento_id uuid DEFAULT NULL, p_actor uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_projeto_id uuid;
  v_user uuid;
  v_doc record;
  v_tarefa_id uuid;
  v_secao_outros_id uuid;
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

    -- Sem correspondência: agrupa por tipo em "Outros documentos"
    IF v_tarefa_id IS NULL THEN
      IF v_secao_outros_id IS NULL THEN
        SELECT id INTO v_secao_outros_id
        FROM public.projeto_secoes
        WHERE projeto_id = v_projeto_id AND nome = 'Outros documentos' LIMIT 1;

        IF v_secao_outros_id IS NULL THEN
          SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_secao_ordem
          FROM public.projeto_secoes WHERE projeto_id = v_projeto_id;
          INSERT INTO public.projeto_secoes (projeto_id, nome, ordem)
          VALUES (v_projeto_id, 'Outros documentos', COALESCE(v_secao_ordem, 1))
          RETURNING id INTO v_secao_outros_id;
        END IF;
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
        WHERE projeto_id = v_projeto_id AND secao_id = v_secao_outros_id;

        INSERT INTO public.projeto_tarefas (
          projeto_id, secao_id, titulo, descricao, status,
          criador_id, canal_criacao, tipo_tarefa, ordem, data_prazo, campos_customizados
        ) VALUES (
          v_projeto_id, v_secao_outros_id, v_label,
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
$$;

-- ============================================================
-- 4. Reparo de projetos já criados
-- ============================================================
CREATE OR REPLACE FUNCTION public.rpc_china_reparar_documentos_projeto(
  p_submissao_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_projeto_id uuid;
  v_user uuid := auth.uid();
  v_doc record;
  v_alvo uuid;
  v_movidos int := 0;
  v_arquivadas int := 0;
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

    -- move anexo espelhado
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

    -- move vínculo
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

  -- arquiva tarefas automáticas que ficaram vazias
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
    'arquivadas', v_arquivadas,
    'vinculados', COALESCE((v_sync->>'vinculados')::int, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_china_reparar_documentos_projeto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_china_resolver_tarefa_documento(uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.china_doc_label(uuid, text, uuid) TO authenticated;

-- ============================================================
-- 5. Sincronização de exclusão / troca de arquivo
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_china_doc_sync_projeto_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.projeto_tarefa_anexos a
    WHERE a.metadata->>'china_documento_id' = OLD.id::text;
  DELETE FROM public.china_documento_tarefa_vinculos v
    WHERE v.documento_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_doc_sync_projeto_delete ON public.china_produto_documentos;
CREATE TRIGGER trg_china_doc_sync_projeto_delete
  BEFORE DELETE ON public.china_produto_documentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_china_doc_sync_projeto_delete();

CREATE OR REPLACE FUNCTION public.tg_china_doc_sync_projeto_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.arquivo_path IS DISTINCT FROM OLD.arquivo_path
     OR NEW.nome_arquivo IS DISTINCT FROM OLD.nome_arquivo
     OR NEW.arquivo_url IS DISTINCT FROM OLD.arquivo_url THEN
    UPDATE public.projeto_tarefa_anexos a
       SET storage_path = COALESCE(NEW.arquivo_path, a.storage_path),
           nome = COALESCE(NEW.nome_arquivo, a.nome),
           metadata = a.metadata || jsonb_build_object('arquivo_url', NEW.arquivo_url)
     WHERE a.metadata->>'china_documento_id' = NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_china_doc_sync_projeto_update ON public.china_produto_documentos;
CREATE TRIGGER trg_china_doc_sync_projeto_update
  AFTER UPDATE ON public.china_produto_documentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_china_doc_sync_projeto_update();