
ALTER TABLE public.fluxo_aprovacao_etapa_eventos
  ALTER COLUMN instancia_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_avancar_item_aprovacao(p_item_id uuid, p_decisao text, p_comentario text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_item public.aprovacao_documento_itens%ROWTYPE;
  v_etapa_atual public.fluxo_aprovacao_etapas%ROWTYPE;
  v_proxima public.fluxo_aprovacao_etapas%ROWTYPE;
  v_novo_item uuid;
  v_uid uuid := auth.uid();
  v_raiz uuid;
  v_responsavel uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_decisao NOT IN ('aprovado','rejeitado','encaminhado') THEN
    RAISE EXCEPTION 'Decisão inválida';
  END IF;

  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF v_item.status <> 'em_andamento' THEN RAISE EXCEPTION 'Item já finalizado (%)', v_item.status; END IF;

  IF v_item.responsavel_atual_id IS DISTINCT FROM v_uid
     AND NOT has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Usuário não é o responsável atual';
  END IF;

  v_raiz := COALESCE(v_item.parent_item_id, v_item.id);

  SELECT * INTO v_etapa_atual FROM public.fluxo_aprovacao_etapas WHERE id = v_item.etapa_atual_id;

  INSERT INTO public.fluxo_aprovacao_etapa_eventos(
    instancia_id, item_id, etapa_ordem, etapa_nome, rodada,
    responsavel_id, decisao, decidido_por, comentario, concluido_em
  ) VALUES (
    v_item.lote_id,
    v_item.id, COALESCE(v_etapa_atual.ordem, 0), v_etapa_atual.nome, 1,
    v_item.responsavel_atual_id,
    CASE WHEN p_decisao = 'encaminhado' THEN 'aprovado' ELSE p_decisao END,
    v_uid, p_comentario, now()
  );

  IF p_decisao = 'rejeitado' THEN
    UPDATE public.aprovacao_documento_itens
       SET status='rejeitado', comentario_atual=p_comentario, responsavel_atual_id=NULL
     WHERE id = p_item_id;
    RETURN jsonb_build_object('status','rejeitado');
  END IF;

  IF v_etapa_atual.tipo = 'encaminhamento' AND v_etapa_atual.pipeline_destino_id IS NOT NULL THEN
    SELECT * INTO v_proxima FROM public.fluxo_aprovacao_etapas
      WHERE config_id = v_etapa_atual.pipeline_destino_id AND ativo = true
      ORDER BY ordem ASC LIMIT 1;
    IF FOUND THEN
      v_responsavel := public.fn_resolver_responsavel_etapa(v_raiz, v_proxima.id, v_proxima.responsavel_id);
      INSERT INTO public.aprovacao_documento_itens(
        documento_id, pipeline_id, etapa_atual_id, responsavel_atual_id,
        status, lote_id, parent_item_id, projeto_id, secao_id, tarefa_id, created_by
      ) VALUES (
        v_item.documento_id, v_etapa_atual.pipeline_destino_id, v_proxima.id, v_responsavel,
        'em_andamento', v_item.lote_id, v_item.id, v_item.projeto_id, v_item.secao_id, v_item.tarefa_id, v_uid
      ) RETURNING id INTO v_novo_item;
    END IF;
    UPDATE public.aprovacao_documento_itens
       SET status='encaminhado', comentario_atual=p_comentario, responsavel_atual_id=NULL
     WHERE id = p_item_id;
    RETURN jsonb_build_object('status','encaminhado','novo_item_id', v_novo_item);
  END IF;

  SELECT * INTO v_proxima FROM public.fluxo_aprovacao_etapas
    WHERE config_id = v_item.pipeline_id AND ativo = true AND ordem > v_etapa_atual.ordem
    ORDER BY ordem ASC LIMIT 1;

  IF NOT FOUND THEN
    UPDATE public.aprovacao_documento_itens
       SET status='aprovado', comentario_atual=p_comentario, responsavel_atual_id=NULL
     WHERE id = p_item_id;
    RETURN jsonb_build_object('status','aprovado');
  END IF;

  v_responsavel := public.fn_resolver_responsavel_etapa(v_raiz, v_proxima.id, v_proxima.responsavel_id);

  UPDATE public.aprovacao_documento_itens
     SET etapa_atual_id = v_proxima.id,
         responsavel_atual_id = v_responsavel,
         comentario_atual = p_comentario
   WHERE id = p_item_id;

  RETURN jsonb_build_object('status','em_andamento','etapa_id', v_proxima.id);
END $function$;
