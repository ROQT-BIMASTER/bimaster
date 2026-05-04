CREATE OR REPLACE FUNCTION public.rpc_comentar_item_aprovacao(p_item_id uuid, p_comentario text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.aprovacao_documento_itens%ROWTYPE;
  v_id uuid;
  v_pode boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF p_comentario IS NULL OR length(trim(p_comentario)) = 0 THEN
    RAISE EXCEPTION 'Comentário vazio';
  END IF;
  IF length(p_comentario) > 4000 THEN
    RAISE EXCEPTION 'Comentário muito longo (máx. 4000 caracteres)';
  END IF;

  SELECT * INTO v_item FROM public.aprovacao_documento_itens WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;

  -- Permissão: responsável atual, criador, membro do projeto ou admin
  IF v_item.responsavel_atual_id = v_uid
     OR v_item.criado_por = v_uid
     OR public.has_role(v_uid, 'admin'::app_role) THEN
    v_pode := true;
  ELSIF v_item.projeto_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projeto_membros
     WHERE projeto_id = v_item.projeto_id AND user_id = v_uid
  ) THEN
    v_pode := true;
  END IF;

  IF NOT v_pode THEN
    RAISE EXCEPTION 'Sem permissão para comentar neste item';
  END IF;

  INSERT INTO public.aprovacao_kanban_audit(
    item_id, user_id, comentario, origem, acao, metadata,
    status_anterior, status_novo
  ) VALUES (
    p_item_id, v_uid, p_comentario, 'comentario', 'comentario',
    '{}'::jsonb, v_item.status, v_item.status
  ) RETURNING id INTO v_id;

  -- Notifica o responsável atual se o comentário não for dele
  IF v_item.responsavel_atual_id IS NOT NULL AND v_item.responsavel_atual_id <> v_uid THEN
    INSERT INTO public.notificacoes(user_id, titulo, mensagem, tipo, referencia_id, referencia_tipo)
    VALUES (
      v_item.responsavel_atual_id,
      'Novo comentário em item de aprovação',
      left(p_comentario, 240),
      'aprovacao_comentario',
      p_item_id::text,
      'aprovacao_item'
    );
  END IF;

  RETURN v_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.rpc_comentar_item_aprovacao(uuid, text) TO authenticated;