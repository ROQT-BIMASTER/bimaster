DROP FUNCTION IF EXISTS public.test_rpc_comentar_item_aprovacao();
DROP FUNCTION IF EXISTS public.test_rpc_comentar_item_aprovacao(uuid);

CREATE OR REPLACE FUNCTION public.test_rpc_comentar_item_aprovacao(p_admin uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
  v_user_creator uuid;
  v_user_resp uuid;
  v_user_outro uuid;
  v_pipeline_id uuid;
  v_etapa_id uuid;
  v_doc_id uuid;
  v_item_id uuid;
  v_item_inexistente uuid := gen_random_uuid();
  v_audit_id uuid;
  v_audit_count integer;
  v_audit_row public.aprovacao_kanban_audit%ROWTYPE;
  v_long_text text;
  v_orig_uid text;
  v_caller uuid := auth.uid();
BEGIN
  -- Resolve admin: parâmetro explícito OU caller autenticado.
  v_admin := COALESCE(p_admin, v_caller);
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Forneça um UUID de admin: SELECT public.test_rpc_comentar_item_aprovacao(''<uuid>'');';
  END IF;
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Usuário % não é admin', v_admin;
  END IF;

  v_orig_uid := current_setting('request.jwt.claim.sub', true);

  -- Pega 3 perfis distintos do admin para usar como criador, responsável e "outro".
  SELECT id INTO v_user_creator
    FROM public.profiles WHERE id <> v_admin LIMIT 1;
  SELECT id INTO v_user_resp
    FROM public.profiles WHERE id NOT IN (v_admin, v_user_creator) LIMIT 1;
  SELECT id INTO v_user_outro
    FROM public.profiles p
    WHERE id NOT IN (v_admin, v_user_creator, v_user_resp)
      AND NOT public.has_role(p.id, 'admin'::app_role)
    LIMIT 1;

  IF v_user_creator IS NULL OR v_user_resp IS NULL OR v_user_outro IS NULL THEN
    RAISE EXCEPTION 'Fixtures insuficientes (precisa admin + 3 perfis distintos, sendo o "outro" não-admin)';
  END IF;

  -- ====== Fixtures (sem projeto_id para isolar permissão) ======
  INSERT INTO public.aprovacao_pipelines(nome, ativo, created_by)
  VALUES ('TEST_pipeline_' || gen_random_uuid()::text, true, v_admin)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.aprovacao_pipeline_etapas(pipeline_id, nome, ordem, tipo, sla_horas)
  VALUES (v_pipeline_id, 'TEST_etapa', 1, 'aprovacao', 24)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.aprovacao_documentos(nome, tipo, pipeline_id, created_by)
  VALUES ('TEST_doc_' || gen_random_uuid()::text, 'arte', v_pipeline_id, v_admin)
  RETURNING id INTO v_doc_id;

  INSERT INTO public.aprovacao_documento_itens(
    documento_id, pipeline_id, etapa_atual_id, responsavel_atual_id,
    status, created_by, projeto_id
  )
  VALUES (
    v_doc_id, v_pipeline_id, v_etapa_id, v_user_resp,
    'em_andamento', v_user_creator, NULL
  )
  RETURNING id INTO v_item_id;

  -- ====== T1: comentário vazio (como criador) ======
  PERFORM set_config('request.jwt.claim.sub', v_user_creator::text, true);
  BEGIN
    PERFORM public.rpc_comentar_item_aprovacao(v_item_id, '   ');
    RAISE EXCEPTION 'T1 FAIL: comentário vazio deveria ter sido bloqueado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%vazio%' THEN
      RAISE EXCEPTION 'T1 FAIL: erro inesperado: %', SQLERRM;
    END IF;
  END;

  -- ====== T2: comentário >4000 chars ======
  v_long_text := repeat('a', 4001);
  BEGIN
    PERFORM public.rpc_comentar_item_aprovacao(v_item_id, v_long_text);
    RAISE EXCEPTION 'T2 FAIL: comentário >4000 deveria ter sido bloqueado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%muito longo%' THEN
      RAISE EXCEPTION 'T2 FAIL: erro inesperado: %', SQLERRM;
    END IF;
  END;

  -- ====== T3: item inexistente ======
  BEGIN
    PERFORM public.rpc_comentar_item_aprovacao(v_item_inexistente, 'oi');
    RAISE EXCEPTION 'T3 FAIL: item inexistente deveria ter sido bloqueado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%não encontrado%' THEN
      RAISE EXCEPTION 'T3 FAIL: erro inesperado: %', SQLERRM;
    END IF;
  END;

  -- ====== T4: usuário sem permissão é bloqueado ======
  PERFORM set_config('request.jwt.claim.sub', v_user_outro::text, true);
  BEGIN
    PERFORM public.rpc_comentar_item_aprovacao(v_item_id, 'tentativa indevida');
    RAISE EXCEPTION 'T4 FAIL: usuário sem permissão deveria ter sido bloqueado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Sem permissão%' THEN
      RAISE EXCEPTION 'T4 FAIL: erro inesperado: %', SQLERRM;
    END IF;
  END;

  -- ====== T5: criador (created_by) PODE comentar e linha persistida ======
  PERFORM set_config('request.jwt.claim.sub', v_user_creator::text, true);
  v_audit_id := public.rpc_comentar_item_aprovacao(v_item_id, 'comentario do criador');
  IF v_audit_id IS NULL THEN
    RAISE EXCEPTION 'T5 FAIL: RPC retornou NULL';
  END IF;
  SELECT * INTO v_audit_row FROM public.aprovacao_kanban_audit WHERE id = v_audit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'T5 FAIL: linha não persistida';
  END IF;
  IF v_audit_row.user_id <> v_user_creator THEN
    RAISE EXCEPTION 'T5 FAIL: user_id deveria ser o criador. Esperado %, obtido %',
      v_user_creator, v_audit_row.user_id;
  END IF;
  IF v_audit_row.acao <> 'comentario' OR v_audit_row.origem <> 'comentario' THEN
    RAISE EXCEPTION 'T5 FAIL: acao/origem incorretos: %, %', v_audit_row.acao, v_audit_row.origem;
  END IF;
  IF v_audit_row.comentario <> 'comentario do criador' THEN
    RAISE EXCEPTION 'T5 FAIL: texto incorreto: %', v_audit_row.comentario;
  END IF;
  IF v_audit_row.item_id <> v_item_id THEN
    RAISE EXCEPTION 'T5 FAIL: item_id incorreto';
  END IF;

  -- ====== T6: responsável atual também PODE comentar ======
  PERFORM set_config('request.jwt.claim.sub', v_user_resp::text, true);
  v_audit_id := public.rpc_comentar_item_aprovacao(v_item_id, 'comentario do responsavel');
  SELECT * INTO v_audit_row FROM public.aprovacao_kanban_audit WHERE id = v_audit_id;
  IF v_audit_row.user_id <> v_user_resp THEN
    RAISE EXCEPTION 'T6 FAIL: user_id deveria ser o responsável atual';
  END IF;

  -- ====== T7: contagem == 2 ======
  SELECT count(*) INTO v_audit_count
  FROM public.aprovacao_kanban_audit
  WHERE item_id = v_item_id AND acao = 'comentario';
  IF v_audit_count <> 2 THEN
    RAISE EXCEPTION 'T7 FAIL: esperado 2 comentários, obtido %', v_audit_count;
  END IF;

  -- ====== Cleanup ======
  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_orig_uid, ''), true);
  DELETE FROM public.aprovacao_kanban_audit WHERE item_id = v_item_id;
  DELETE FROM public.notificacoes WHERE referencia_id = v_item_id::text AND referencia_tipo = 'aprovacao_item';
  DELETE FROM public.aprovacao_documento_itens WHERE id = v_item_id;
  DELETE FROM public.aprovacao_documentos WHERE id = v_doc_id;
  DELETE FROM public.aprovacao_pipeline_etapas WHERE pipeline_id = v_pipeline_id;
  DELETE FROM public.aprovacao_pipelines WHERE id = v_pipeline_id;

  RETURN 'OK: 7/7 asserções passaram';
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_orig_uid, ''), true);
  IF v_item_id IS NOT NULL THEN
    DELETE FROM public.aprovacao_kanban_audit WHERE item_id = v_item_id;
    DELETE FROM public.notificacoes WHERE referencia_id = v_item_id::text AND referencia_tipo = 'aprovacao_item';
    DELETE FROM public.aprovacao_documento_itens WHERE id = v_item_id;
  END IF;
  IF v_doc_id IS NOT NULL THEN
    DELETE FROM public.aprovacao_documentos WHERE id = v_doc_id;
  END IF;
  IF v_pipeline_id IS NOT NULL THEN
    DELETE FROM public.aprovacao_pipeline_etapas WHERE pipeline_id = v_pipeline_id;
    DELETE FROM public.aprovacao_pipelines WHERE id = v_pipeline_id;
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.test_rpc_comentar_item_aprovacao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_rpc_comentar_item_aprovacao(uuid) TO authenticated;

COMMENT ON FUNCTION public.test_rpc_comentar_item_aprovacao(uuid) IS
'Suite de integração da RPC rpc_comentar_item_aprovacao. Uso: SELECT public.test_rpc_comentar_item_aprovacao(''<admin-uuid>''); — o admin precisa existir em user_roles.';