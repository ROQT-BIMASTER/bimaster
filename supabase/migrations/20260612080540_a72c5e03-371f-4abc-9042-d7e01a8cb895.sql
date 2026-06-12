
CREATE OR REPLACE FUNCTION public.rpc_b2c_sync_tarefa_espelho(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item       record;
  v_projeto_id uuid;
  v_secao_id   uuid;
  v_tarefa_id  uuid;
  v_prazo_dias int;
  v_uid        uuid := auth.uid();
  v_criador    uuid;
  v_ordem      int;
  v_criada     boolean := false;
BEGIN
  SELECT * INTO v_item FROM public.china_checklist_brasil_china WHERE id = p_item_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('skipped','item_nao_encontrado'); END IF;

  IF v_item.arquivo_path IS NULL OR length(trim(v_item.arquivo_path)) = 0 THEN
    RETURN jsonb_build_object('skipped','sem_arquivo');
  END IF;

  SELECT projeto_id INTO v_projeto_id
  FROM public.china_submissao_projetos
  WHERE submissao_id = v_item.submissao_id AND is_espelho = true
  LIMIT 1;
  IF v_projeto_id IS NULL THEN RETURN jsonb_build_object('skipped','sem_espelho'); END IF;

  v_criador := COALESCE(v_item.created_by, v_uid);

  SELECT id INTO v_secao_id
  FROM public.projeto_secoes
  WHERE projeto_id = v_projeto_id AND nome = 'Documentos da Submissão'
  LIMIT 1;
  IF v_secao_id IS NULL THEN
    INSERT INTO public.projeto_secoes (projeto_id, nome, ordem)
    VALUES (v_projeto_id, 'Documentos da Submissão', 0)
    RETURNING id INTO v_secao_id;
  END IF;

  v_tarefa_id := v_item.projeto_tarefa_id;
  IF v_tarefa_id IS NOT NULL THEN
    PERFORM 1 FROM public.projeto_tarefas WHERE id = v_tarefa_id;
    IF NOT FOUND THEN v_tarefa_id := NULL; END IF;
  END IF;

  IF v_tarefa_id IS NULL THEN
    SELECT COALESCE(v_item.sla_dias, p.prazo_padrao_tarefa, 5)
    INTO v_prazo_dias
    FROM public.projetos p WHERE p.id = v_projeto_id;

    SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem
    FROM public.projeto_tarefas
    WHERE projeto_id = v_projeto_id AND secao_id = v_secao_id;

    INSERT INTO public.projeto_tarefas (
      projeto_id, secao_id, titulo, descricao, status,
      criador_id, canal_criacao, tipo_tarefa, ordem, data_prazo
    ) VALUES (
      v_projeto_id, v_secao_id, v_item.nome_documento,
      'Item Brasil → China · categoria ' || v_item.categoria
        || COALESCE(' · ' || v_item.descricao, ''),
      'pendente', v_criador,
      'china_submissao_b2c', 'china_checklist_b2c',
      v_ordem,
      (current_date + COALESCE(v_prazo_dias, 5))::date
    )
    RETURNING id INTO v_tarefa_id;

    v_criada := true;

    IF v_item.responsavel_brasil_id IS NOT NULL THEN
      INSERT INTO public.projeto_tarefa_responsaveis (tarefa_id, user_id, papel, criado_por)
      VALUES (v_tarefa_id, v_item.responsavel_brasil_id, 'responsavel', v_uid)
      ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.china_checklist_brasil_china
      SET projeto_tarefa_id = v_tarefa_id
    WHERE id = p_item_id;
  END IF;

  -- Adiciona anexo se ainda não existir um para este storage_path
  IF NOT EXISTS (
    SELECT 1 FROM public.projeto_tarefa_anexos
    WHERE tarefa_id = v_tarefa_id AND storage_path = v_item.arquivo_path
  ) THEN
    INSERT INTO public.projeto_tarefa_anexos (
      tarefa_id, user_id, nome, storage_path, tipo_arquivo, tamanho, metadata
    ) VALUES (
      v_tarefa_id, COALESCE(v_uid, v_criador),
      COALESCE(v_item.arquivo_nome, v_item.nome_documento, 'documento'),
      v_item.arquivo_path, 'china_checklist_b2c',
      v_item.arquivo_tamanho_bytes,
      jsonb_build_object(
        'origem','china_checklist_b2c',
        'submissao_id', v_item.submissao_id,
        'b2c_item_id', v_item.id,
        'status_b2c', v_item.status,
        'bucket', 'china-documentos'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'projeto_tarefa_id', v_tarefa_id,
    'projeto_id', v_projeto_id,
    'secao_id', v_secao_id,
    'criada', v_criada
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_b2c_sync_tarefa_espelho(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.rpc_b2c_sync_tarefa_espelho(uuid) TO authenticated;

-- Trigger
CREATE OR REPLACE FUNCTION public.fn_b2c_sync_tarefa_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.arquivo_path IS NULL OR length(trim(NEW.arquivo_path)) = 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.arquivo_path IS DISTINCT FROM OLD.arquivo_path
     OR NEW.projeto_tarefa_id IS NULL THEN
    BEGIN
      PERFORM public.rpc_b2c_sync_tarefa_espelho(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fn_b2c_sync_tarefa_trigger falhou para item %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_b2c_sync_tarefa ON public.china_checklist_brasil_china;
CREATE TRIGGER trg_b2c_sync_tarefa
  AFTER INSERT OR UPDATE OF arquivo_path
  ON public.china_checklist_brasil_china
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_b2c_sync_tarefa_trigger();
