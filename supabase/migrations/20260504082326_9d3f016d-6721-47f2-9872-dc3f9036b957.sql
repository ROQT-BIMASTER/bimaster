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
  v_admin := COALESCE(p_admin, v_caller);
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Forneça um UUID de admin: SELECT public.test_rpc_comentar_item_aprovacao(''<uuid>'');';
  END IF;
  IF NOT public.has_role(v_admin, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Usuário % não é admin', v_admin;
  END IF;

  v_orig_uid := current_setting('request.jwt.claim.sub', true);

  -- Reaproveita refs existentes (FKs amarradas em fluxo_aprovacao_config, china_produto_documentos, etc).
  SELECT documento_id, pipeline_id, etapa_atual_id
    INTO v_doc_id, v_pipeline_id, v_etapa_id
  FROM public.aprovacao_documento_itens
  WHERE etapa_atual_id IS NOT NULL
  LIMIT 1;
  IF v_doc_id IS NULL THEN
    RAISE EXCEPTION 'Sem item existente para extrair refs (documento/pipeline/etapa).';
  END IF;

  -- 3 perfis distintos do admin.
  SELECT id INTO v_user_creator FROM public.profiles WHERE id <> v_admin LIMIT 1;
  SELECT id INTO v_user_resp    FROM public.profiles WHERE id NOT IN (v_admin, v_user_creator) LIMIT 1;
  SELECT id INTO v_user_outro
    FROM public.profiles p
    WHERE id NOT IN (v_admin, v_user_creator, v_user_resp)
      AND NOT public.has_role(p.id, 'admin'::app_role)
      AND NOT EXISTS (
        SELECT 1 FROM public.projeto_membros pm WHERE pm.user_id = p.id
      )
    LIMIT 1;
  IF v_user_creator IS NULL OR v_user_resp IS NULL OR v_user_outro IS NULL THEN
    RAISE EXCEPTION 'Fixtures insuficientes (admin + 3 perfis distintos, 1 não-admin sem projetos)';
  END IF;

  -- Item de teste SEM projeto_id (isola permissão para criador/responsável/admin).
  INSERT INTO public.aprovacao_documento_itens(
    documento_id, pipeline_id, etapa_atual_id, responsavel_atual_id,
    status, created_by, projeto_id
  ) VALUES (
    v_doc_id, v_pipeline_id, v_etapa_id, v_user_resp,
    'em_andamento', v_user_creator, NULL
  ) RETURNING id INTO v_item_id;

  -- T1: vazio
  PERFORM set_config('request.jwt.claim.sub', v_user_creator::text, true);
  BEGIN
    PERFORM public.rpc_comentar_item_aprovacao(v_item_id, '   ');
    RAISE EXCEPTION 'T1 FAIL: vazio deveria bloquear';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%vazio%' THEN RAISE EXCEPTION 'T1 FAIL: %', SQLERRM; END IF;
  END;

  -- T2: > 4000
  v_long_text := repeat('a', 4001);
  BEGIN
    PERFORM public.rpc_comentar_item_aprovacao(v_item_id, v_long_text);
    RAISE EXCEPTION 'T2 FAIL: muito longo deveria bloquear';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%muito longo%' THEN RAISE EXCEPTION 'T2 FAIL: %', SQLERRM; END IF;
  END;

  -- T3: item inexistente
  BEGIN
    PERFORM public.rpc_comentar_item_aprovacao(v_item_inexistente, 'oi');
    RAISE EXCEPTION 'T3 FAIL: item inexistente deveria bloquear';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%não encontrado%' THEN RAISE EXCEPTION 'T3 FAIL: %', SQLERRM; END IF;
  END;

  -- T4: sem permissão
  PERFORM set_config('request.jwt.claim.sub', v_user_outro::text, true);
  BEGIN
    PERFORM public.rpc_comentar_item_aprovacao(v_item_id, 'tentativa');
    RAISE EXCEPTION 'T4 FAIL: sem permissão deveria bloquear';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Sem permissão%' THEN RAISE EXCEPTION 'T4 FAIL: %', SQLERRM; END IF;
  END;

  -- T5: criador comenta e linha persistida com user_id == created_by
  PERFORM set_config('request.jwt.claim.sub', v_user_creator::text, true);
  v_audit_id := public.rpc_comentar_item_aprovacao(v_item_id, 'comentario do criador');
  IF v_audit_id IS NULL THEN RAISE EXCEPTION 'T5 FAIL: RPC retornou NULL'; END IF;
  SELECT * INTO v_audit_row FROM public.aprovacao_kanban_audit WHERE id = v_audit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'T5 FAIL: linha não persistida'; END IF;
  IF v_audit_row.user_id <> v_user_creator THEN
    RAISE EXCEPTION 'T5 FAIL: user_id deveria ser o criador. Esperado %, obtido %',
      v_user_creator, v_audit_row.user_id;
  END IF;
  IF v_audit_row.acao <> 'comentario' OR v_audit_row.origem <> 'comentario' THEN
    RAISE EXCEPTION 'T5 FAIL: acao=%, origem=%', v_audit_row.acao, v_audit_row.origem;
  END IF;
  IF v_audit_row.comentario <> 'comentario do criador' THEN
    RAISE EXCEPTION 'T5 FAIL: texto incorreto: %', v_audit_row.comentario;
  END IF;
  IF v_audit_row.item_id <> v_item_id THEN
    RAISE EXCEPTION 'T5 FAIL: item_id incorreto';
  END IF;

  -- T6: responsável atual comenta
  PERFORM set_config('request.jwt.claim.sub', v_user_resp::text, true);
  v_audit_id := public.rpc_comentar_item_aprovacao(v_item_id, 'comentario do responsavel');
  SELECT * INTO v_audit_row FROM public.aprovacao_kanban_audit WHERE id = v_audit_id;
  IF v_audit_row.user_id <> v_user_resp THEN
    RAISE EXCEPTION 'T6 FAIL: user_id deveria ser o responsável atual';
  END IF;

  -- T7: contagem == 2
  SELECT count(*) INTO v_audit_count
  FROM public.aprovacao_kanban_audit
  WHERE item_id = v_item_id AND acao = 'comentario';
  IF v_audit_count <> 2 THEN
    RAISE EXCEPTION 'T7 FAIL: esperado 2, obtido %', v_audit_count;
  END IF;

  -- Cleanup
  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_orig_uid, ''), true);
  DELETE FROM public.aprovacao_kanban_audit WHERE item_id = v_item_id;
  DELETE FROM public.notificacoes WHERE referencia_id = v_item_id::text AND referencia_tipo = 'aprovacao_item';
  DELETE FROM public.aprovacao_documento_itens WHERE id = v_item_id;

  RETURN 'OK: 7/7 asserções passaram';
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_orig_uid, ''), true);
  IF v_item_id IS NOT NULL THEN
    DELETE FROM public.aprovacao_kanban_audit WHERE item_id = v_item_id;
    DELETE FROM public.notificacoes WHERE referencia_id = v_item_id::text AND referencia_tipo = 'aprovacao_item';
    DELETE FROM public.aprovacao_documento_itens WHERE id = v_item_id;
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.test_rpc_comentar_item_aprovacao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_rpc_comentar_item_aprovacao(uuid) TO authenticated;