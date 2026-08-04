CREATE OR REPLACE FUNCTION public.rpc_avancar_itens_aprovacao_lote(
  p_item_ids uuid[],
  p_decisao text,
  p_comentario text DEFAULT NULL,
  p_step_up_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ok boolean;
  v_item_id uuid;
  v_res jsonb;
  v_resultados jsonb := '[]'::jsonb;
  v_sucesso int := 0;
  v_falha int := 0;
  v_item public.aprovacao_documento_itens%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  IF p_decisao NOT IN ('aprovado','rejeitado','em_revisao') THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;

  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum item informado';
  END IF;

  IF array_length(p_item_ids, 1) > 200 THEN
    RAISE EXCEPTION 'Limite de 200 itens por lote';
  END IF;

  IF p_step_up_token IS NULL OR length(p_step_up_token) < 16 THEN
    RAISE EXCEPTION 'Confirmação de senha obrigatória';
  END IF;

  v_ok := public.validate_step_up_token(
    v_uid,
    encode(extensions.digest(p_step_up_token, 'sha256'), 'hex'),
    'aprovacoes.lote'
  );
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Confirmação de senha inválida ou expirada';
  END IF;

  FOREACH v_item_id IN ARRAY p_item_ids LOOP
    BEGIN
      SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = v_item_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item não encontrado';
      END IF;

      IF p_decisao = 'em_revisao' THEN
        PERFORM public.rpc_mover_item_coluna(v_item_id, 'em_revisao', p_comentario);
        v_res := jsonb_build_object('status', 'em_revisao');
      ELSE
        v_res := public.rpc_avancar_item_aprovacao(v_item_id, p_decisao, p_comentario);
      END IF;

      INSERT INTO public.aprovacao_kanban_audit(
        item_id, user_id, status_anterior, status_novo,
        etapa_anterior_id, comentario, origem, acao, metadata
      ) VALUES (
        v_item_id, v_uid, v_item.status, COALESCE(v_res->>'status', p_decisao),
        v_item.etapa_atual_id, p_comentario, 'central_aprovacoes', 'decisao_lote',
        jsonb_build_object('decisao', p_decisao, 'metodo', 'senha', 'lote', true)
      );

      v_sucesso := v_sucesso + 1;
      v_resultados := v_resultados || jsonb_build_object('item_id', v_item_id, 'ok', true, 'resultado', v_res);
    EXCEPTION WHEN OTHERS THEN
      v_falha := v_falha + 1;
      v_resultados := v_resultados || jsonb_build_object('item_id', v_item_id, 'ok', false, 'erro', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'sucesso', v_sucesso,
    'falha', v_falha,
    'resultados', v_resultados
  );
END $function$;

REVOKE EXECUTE ON FUNCTION public.rpc_avancar_itens_aprovacao_lote(uuid[], text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_avancar_itens_aprovacao_lote(uuid[], text, text, text) TO authenticated;