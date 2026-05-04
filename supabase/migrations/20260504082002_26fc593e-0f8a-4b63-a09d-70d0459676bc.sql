-- Test harness para a RPC public.rpc_comentar_item_aprovacao
-- Roda como um admin: SELECT public.test_rpc_comentar_item_aprovacao();
-- Levanta exceção descritiva em qualquer asserção falha; retorna 'OK' se tudo passar.

CREATE OR REPLACE FUNCTION public.test_rpc_comentar_item_aprovacao()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_admin_only boolean;
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
  v_orig_role text;
  v_orig_uid text;
BEGIN
  -- Apenas admin pode rodar este harness (evita uso indevido).
  IF v_caller IS NULL OR NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'test_rpc_comentar_item_aprovacao: somente admin pode executar';
  END IF;

  -- Captura GUCs para restaurar ao final.
  v_orig_role := current_setting('role', true);
  v_orig_uid  := current_setting('request.jwt.claim.sub', true);

  -- Pega 3 usuários reais distintos para usar como criador, responsável e "outro".
  SELECT id INTO v_user_creator FROM public.profiles WHERE id <> v_caller LIMIT 1;
  SELECT id INTO v_user_resp    FROM public.profiles WHERE id NOT IN (v_caller, v_user_creator) LIMIT 1;
  SELECT id INTO v_user_outro   FROM public.profiles WHERE id NOT IN (v_caller, v_user_creator, v_user_resp) LIMIT 1;

  IF v_user_creator IS NULL OR v_user_resp IS NULL OR v_user_outro IS NULL THEN
    RAISE EXCEPTION 'Fixtures insuficientes: precisa de pelo menos 4 perfis (admin caller + 3 distintos)';
  END IF;

  -- Garante que v_user_outro NÃO é admin nem membro de projeto algum
  -- (a RPC libera membros do projeto). Se for admin, troca por outro.
  IF public.has_role(v_user_outro, 'admin'::app_role) THEN
    SELECT id INTO v_user_outro
    FROM public.profiles p
    WHERE id NOT IN (v_caller, v_user_creator, v_user_resp)
      AND NOT public.has_role(p.id, 'admin'::app_role)
    LIMIT 1;
    IF v_user_outro IS NULL THEN
      RAISE EXCEPTION 'Não foi possível encontrar usuário não-admin distinto para o teste de bloqueio';
    END IF;
  END IF;

  -- ====== Fixtures ======
  -- Cria pipeline + etapa + documento + item SEM projeto_id (para evitar liberar
  -- v_user_outro via projeto_membros).
  INSERT INTO public.aprovacao_pipelines(nome, ativo, created_by)
  VALUES ('TEST_pipeline_' || gen_random_uuid()::text, true, v_caller)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.aprovacao_pipeline_etapas(pipeline_id, nome, ordem, tipo, sla_horas)
  VALUES (v_pipeline_id, 'TEST_etapa', 1, 'aprovacao', 24)
  RETURNING id INTO v_etapa_id;

  INSERT INTO public.aprovacao_documentos(nome, tipo, pipeline_id, created_by)
  VALUES ('TEST_doc_' || gen_random_uuid()::text, 'arte', v_pipeline_id, v_caller)
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

  -- ====== T1: comentário vazio ======
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_creator::text, true);
  BEGIN
    PERFORM public.rpc_comentar_item_aprovacao(v_item_id, '   ');
    RAISE EXCEPTION 'T1 FAIL: comentário vazio deveria ter sido bloqueado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%vazio%' THEN
      RAISE EXCEPTION 'T1 FAIL: erro inesperado: %', SQLERRM;
    END IF;
  END;

  -- ====== T2: comentário acima de 4000 chars ======
  v_long_text := repeat('a', 4001);
  BEGIN
    PERFORM public.rpc_comentar_item_aprovacao(v_item_id, v_long_text);
    RAISE EXCEPTION 'T2 FAIL: comentário >4000 chars deveria ter sido bloqueado';
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

  -- ====== T5: criador (created_by) PODE comentar e a linha é persistida ======
  PERFORM set_config('request.jwt.claim.sub', v_user_creator::text, true);
  v_audit_id := public.rpc_comentar_item_aprovacao(v_item_id, 'comentario do criador');
  IF v_audit_id IS NULL THEN
    RAISE EXCEPTION 'T5 FAIL: RPC retornou NULL';
  END IF;

  SELECT * INTO v_audit_row FROM public.aprovacao_kanban_audit WHERE id = v_audit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'T5 FAIL: linha de auditoria não persistida';
  END IF;
  IF v_audit_row.item_id <> v_item_id THEN
    RAISE EXCEPTION 'T5 FAIL: item_id incorreto';
  END IF;
  IF v_audit_row.user_id <> v_user_creator THEN
    RAISE EXCEPTION 'T5 FAIL: user_id deveria ser o criador (created_by). Esperado %, obtido %',
      v_user_creator, v_audit_row.user_id;
  END IF;
  IF v_audit_row.acao <> 'comentario' OR v_audit_row.origem <> 'comentario' THEN
    RAISE EXCEPTION 'T5 FAIL: acao/origem incorretos: acao=%, origem=%',
      v_audit_row.acao, v_audit_row.origem;
  END IF;
  IF v_audit_row.comentario <> 'comentario do criador' THEN
    RAISE EXCEPTION 'T5 FAIL: texto do comentário incorreto';
  END IF;

  -- ====== T6: responsável atual também PODE comentar ======
  PERFORM set_config('request.jwt.claim.sub', v_user_resp::text, true);
  v_audit_id := public.rpc_comentar_item_aprovacao(v_item_id, 'comentario do responsavel');
  SELECT * INTO v_audit_row FROM public.aprovacao_kanban_audit WHERE id = v_audit_id;
  IF v_audit_row.user_id <> v_user_resp THEN
    RAISE EXCEPTION 'T6 FAIL: user_id deveria ser o responsável atual';
  END IF;

  -- ====== T7: contagem total de comentários do item == 2 ======
  SELECT count(*) INTO v_audit_count
  FROM public.aprovacao_kanban_audit
  WHERE item_id = v_item_id AND acao = 'comentario';
  IF v_audit_count <> 2 THEN
    RAISE EXCEPTION 'T7 FAIL: esperado 2 comentários, obtido %', v_audit_count;
  END IF;

  -- ====== Cleanup ======
  PERFORM set_config('role', COALESCE(v_orig_role, 'postgres'), true);
  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_orig_uid, ''), true);

  DELETE FROM public.aprovacao_kanban_audit WHERE item_id = v_item_id;
  DELETE FROM public.aprovacao_documento_itens WHERE id = v_item_id;
  DELETE FROM public.aprovacao_documentos WHERE id = v_doc_id;
  DELETE FROM public.aprovacao_pipeline_etapas WHERE pipeline_id = v_pipeline_id;
  DELETE FROM public.aprovacao_pipelines WHERE id = v_pipeline_id;

  RETURN 'OK: 7/7 asserções passaram';
EXCEPTION WHEN OTHERS THEN
  -- Restaura GUCs e tenta limpar antes de propagar.
  PERFORM set_config('role', COALESCE(v_orig_role, 'postgres'), true);
  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_orig_uid, ''), true);
  IF v_item_id IS NOT NULL THEN
    DELETE FROM public.aprovacao_kanban_audit WHERE item_id = v_item_id;
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

REVOKE ALL ON FUNCTION public.test_rpc_comentar_item_aprovacao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_rpc_comentar_item_aprovacao() TO authenticated;

COMMENT ON FUNCTION public.test_rpc_comentar_item_aprovacao() IS
'Suite de integração da RPC rpc_comentar_item_aprovacao. Admin-only. Uso: SELECT public.test_rpc_comentar_item_aprovacao();';