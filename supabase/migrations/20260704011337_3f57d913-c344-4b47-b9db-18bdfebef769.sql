
CREATE OR REPLACE FUNCTION public.rpc_suporte_fila_membro(
  p_fila_id uuid,
  p_user_id uuid,
  p_acao    text,
  p_papel   text DEFAULT 'agente'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_is_admin  boolean;
  v_is_lider  boolean;
  v_alvo      record;
  v_lideres   int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_acao NOT IN ('adicionar','remover','papel') THEN RAISE EXCEPTION 'acao invalida'; END IF;
  IF p_papel NOT IN ('agente','lider') THEN RAISE EXCEPTION 'papel invalido'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.suporte_filas WHERE id = p_fila_id AND ativo) THEN
    RAISE EXCEPTION 'fila invalida';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND status = 'ativo') THEN
    RAISE EXCEPTION 'usuario invalido ou inativo';
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  v_is_lider := EXISTS (SELECT 1 FROM public.suporte_fila_agentes
                        WHERE fila_id = p_fila_id AND user_id = v_uid AND ativo AND papel = 'lider');
  IF NOT (v_is_admin OR v_is_lider) THEN
    RAISE EXCEPTION 'sem permissao para gerenciar membros desta fila';
  END IF;

  SELECT * INTO v_alvo FROM public.suporte_fila_agentes
   WHERE fila_id = p_fila_id AND user_id = p_user_id;

  IF NOT v_is_admin THEN
    IF p_papel = 'lider' OR (v_alvo.papel = 'lider' AND coalesce(v_alvo.ativo, false)) THEN
      RAISE EXCEPTION 'apenas admin gerencia lideres';
    END IF;
  END IF;

  IF p_acao = 'adicionar' THEN
    INSERT INTO public.suporte_fila_agentes (fila_id, user_id, papel, ativo)
    VALUES (p_fila_id, p_user_id, p_papel, true)
    ON CONFLICT (fila_id, user_id) DO UPDATE SET ativo = true, papel = EXCLUDED.papel;

    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT t.conversa_id, p_user_id, 'membro'
    FROM public.suporte_tickets t
    JOIN public.conversas c ON c.id = t.conversa_id AND c.tipo = 'suporte'
    WHERE t.fila_id = p_fila_id AND t.status <> 'resolvido'
    ON CONFLICT (conversa_id, usuario_id) DO UPDATE SET saiu_em = NULL;

    -- integração com fluxo kanban: entra no projeto vinculado, se houver
    -- (a coluna suporte_filas.projeto_id é criada pela migration de Fluxo Kanban;
    -- o bloco só age quando a coluna existe e o valor não é nulo).
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='suporte_filas' AND column_name='projeto_id'
    ) THEN
      EXECUTE $sql$
        INSERT INTO public.projeto_membros (projeto_id, user_id, papel)
        SELECT f.projeto_id, $1, CASE WHEN $2 = 'lider' THEN 'coordenador' ELSE 'membro' END
        FROM public.suporte_filas f
        WHERE f.id = $3 AND f.projeto_id IS NOT NULL
        ON CONFLICT DO NOTHING
      $sql$ USING p_user_id, p_papel, p_fila_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'acao', 'adicionar', 'papel', p_papel);
  END IF;

  IF v_alvo IS NULL OR NOT v_alvo.ativo THEN
    RAISE EXCEPTION 'membro nao encontrado nesta fila';
  END IF;

  IF p_acao = 'papel' THEN
    IF v_alvo.papel = 'lider' AND p_papel = 'agente' THEN
      SELECT count(*) INTO v_lideres FROM public.suporte_fila_agentes
       WHERE fila_id = p_fila_id AND ativo AND papel = 'lider';
      IF v_lideres <= 1 THEN RAISE EXCEPTION 'promova outro lider antes de rebaixar o ultimo'; END IF;
    END IF;
    UPDATE public.suporte_fila_agentes SET papel = p_papel
     WHERE fila_id = p_fila_id AND user_id = p_user_id;
    RETURN jsonb_build_object('ok', true, 'acao', 'papel', 'papel', p_papel);
  END IF;

  -- remover
  IF v_alvo.papel = 'lider' THEN
    SELECT count(*) INTO v_lideres FROM public.suporte_fila_agentes
     WHERE fila_id = p_fila_id AND ativo AND papel = 'lider';
    IF v_lideres <= 1 THEN RAISE EXCEPTION 'promova outro lider antes de remover o ultimo'; END IF;
  END IF;

  UPDATE public.suporte_fila_agentes SET ativo = false
   WHERE fila_id = p_fila_id AND user_id = p_user_id;

  WITH devolvidos AS (
    UPDATE public.suporte_tickets t
       SET assignee_id = NULL, ultima_interacao_em = now()
     WHERE t.fila_id = p_fila_id AND t.assignee_id = p_user_id AND t.status <> 'resolvido'
     RETURNING t.id
  )
  INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload)
  SELECT id, 'membro_removido', jsonb_build_object('user_id', p_user_id, 'por', v_uid)
  FROM devolvidos;

  UPDATE public.conversas_participantes cp
     SET saiu_em = now()
    FROM public.suporte_tickets t
   WHERE t.conversa_id = cp.conversa_id
     AND t.fila_id = p_fila_id
     AND t.status <> 'resolvido'
     AND cp.usuario_id = p_user_id
     AND COALESCE(t.requester_id, t.owner_id) <> p_user_id;

  RETURN jsonb_build_object('ok', true, 'acao', 'remover');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_suporte_fila_membro(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_suporte_fila_membro(uuid, uuid, text, text) TO authenticated;
