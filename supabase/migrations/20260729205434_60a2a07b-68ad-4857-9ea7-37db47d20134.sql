CREATE OR REPLACE FUNCTION public.rpc_china_sincronizar_documentos_projeto(
  p_submissao_id uuid,
  p_documento_id uuid DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
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
    SELECT id, nome_arquivo, arquivo_path, arquivo_url, tipo_documento, observacao, status
    FROM public.china_produto_documentos
    WHERE submissao_id = p_submissao_id
      AND projeto_tarefa_id IS NULL
      AND (p_documento_id IS NULL OR id = p_documento_id)
      AND NULLIF(trim(COALESCE(arquivo_path, '')), '') IS NOT NULL
    ORDER BY created_at
  LOOP
    v_path := trim(v_doc.arquivo_path);
    v_tarefa_id := NULL;

    -- 1) Reusa a tarefa já usada por outro documento do mesmo tipo nesta submissão
    SELECT d2.projeto_tarefa_id INTO v_tarefa_id
    FROM public.china_produto_documentos d2
    JOIN public.projeto_tarefas t ON t.id = d2.projeto_tarefa_id AND t.projeto_id = v_projeto_id
    WHERE d2.submissao_id = p_submissao_id
      AND d2.tipo_documento IS NOT DISTINCT FROM v_doc.tipo_documento
      AND d2.projeto_tarefa_id IS NOT NULL
    LIMIT 1;

    -- 2) Resolve rótulo do tipo e casa por título de tarefa do checklist
    IF v_tarefa_id IS NULL THEN
      v_label := NULL;
      IF v_doc.tipo_documento ~ '^cofre_[0-9a-fA-F-]{36}$' THEN
        SELECT c.nome_pt INTO v_label
        FROM public.cofre_produto_config c
        WHERE c.id = substring(v_doc.tipo_documento from 7)::uuid;
      END IF;
      v_label := NULLIF(trim(COALESCE(v_label, v_doc.tipo_documento, '')), '');

      IF v_label IS NOT NULL THEN
        SELECT t.id INTO v_tarefa_id
        FROM public.projeto_tarefas t
        WHERE t.projeto_id = v_projeto_id
          AND t.tipo_tarefa = 'china_checklist_item'
          AND lower(t.titulo) = lower(v_label)
        LIMIT 1;
      END IF;
    END IF;

    -- 3) Sem correspondência: cria tarefa em "Outros documentos"
    IF v_tarefa_id IS NULL THEN
      IF v_secao_outros_id IS NULL THEN
        SELECT id INTO v_secao_outros_id
        FROM public.projeto_secoes
        WHERE projeto_id = v_projeto_id AND nome = 'Outros documentos'
        LIMIT 1;

        IF v_secao_outros_id IS NULL THEN
          SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_secao_ordem
          FROM public.projeto_secoes WHERE projeto_id = v_projeto_id;
          INSERT INTO public.projeto_secoes (projeto_id, nome, ordem)
          VALUES (v_projeto_id, 'Outros documentos', COALESCE(v_secao_ordem, 1))
          RETURNING id INTO v_secao_outros_id;
        END IF;
      END IF;

      SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem
      FROM public.projeto_tarefas
      WHERE projeto_id = v_projeto_id AND secao_id = v_secao_outros_id;

      INSERT INTO public.projeto_tarefas (
        projeto_id, secao_id, titulo, descricao, status,
        criador_id, canal_criacao, tipo_tarefa, ordem, data_prazo
      ) VALUES (
        v_projeto_id, v_secao_outros_id,
        COALESCE(NULLIF(trim(v_label), ''), 'Documento avulso — ' || COALESCE(v_doc.tipo_documento, 'sem tipo')),
        COALESCE(v_doc.observacao, ''),
        CASE v_doc.status
          WHEN 'aprovado' THEN 'concluida'
          WHEN 'rejeitado' THEN 'em_andamento'
          ELSE 'pendente'
        END,
        v_user, 'china_submissao', 'china_documento', COALESCE(v_ordem, 1),
        (v_data_inicio + v_prazo)::date
      )
      RETURNING id INTO v_tarefa_id;

      v_tarefas_criadas := v_tarefas_criadas + 1;
    END IF;

    INSERT INTO public.projeto_tarefa_anexos (
      tarefa_id, user_id, nome, storage_path, tipo_arquivo, metadata
    )
    SELECT
      v_tarefa_id, v_user,
      COALESCE(v_doc.nome_arquivo, v_doc.tipo_documento, 'documento'),
      v_path,
      v_doc.tipo_documento,
      jsonb_build_object(
        'origem','china_submissao',
        'submissao_id', p_submissao_id,
        'china_documento_id', v_doc.id,
        'arquivo_url', v_doc.arquivo_url,
        'bucket', 'china-documentos'
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.projeto_tarefa_anexos a
      WHERE a.tarefa_id = v_tarefa_id
        AND a.metadata->>'china_documento_id' = v_doc.id::text
    );

    UPDATE public.china_produto_documentos
      SET projeto_tarefa_id = v_tarefa_id
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
    'tarefas_criadas', v_tarefas_criadas
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_china_sincronizar_documentos_projeto(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_china_sincronizar_documentos_projeto(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_china_doc_sync_projeto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.projeto_tarefa_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NULLIF(trim(COALESCE(NEW.arquivo_path, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.rpc_china_sincronizar_documentos_projeto(
      NEW.submissao_id, NEW.id, NEW.created_by
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.china_timeline_eventos (kind, title, descricao, submissao_id, payload, actor_label)
      VALUES ('projeto_sync_falhou', 'Falha ao sincronizar documento com o projeto',
              SQLERRM, NEW.submissao_id,
              jsonb_build_object('documento_id', NEW.id), 'sistema');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_china_doc_sync_projeto ON public.china_produto_documentos;
CREATE TRIGGER trg_china_doc_sync_projeto
AFTER INSERT OR UPDATE OF arquivo_path ON public.china_produto_documentos
FOR EACH ROW EXECUTE FUNCTION public.tg_china_doc_sync_projeto();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT submissao_id FROM public.china_submissao_projetos WHERE is_espelho = true
  LOOP
    BEGIN
      PERFORM public.rpc_china_sincronizar_documentos_projeto(r.submissao_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;