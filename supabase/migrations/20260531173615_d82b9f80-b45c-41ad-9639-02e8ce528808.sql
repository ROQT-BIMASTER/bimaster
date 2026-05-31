CREATE OR REPLACE FUNCTION public.rpc_cutucar_mensagem(
  p_mensagem_alvo_id uuid,
  p_motivo text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_alvo record;
  v_aprovacao_id uuid;
  v_solicitante uuid;
  v_count int;
  v_permitido boolean;
  v_msg_id uuid;
  v_conteudo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 8 THEN
    RAISE EXCEPTION 'Informe o motivo (mínimo 8 caracteres) ao chamar a atenção da equipe.';
  END IF;

  -- Carrega mensagem alvo
  SELECT id, conversa_id, remetente_id, conteudo, tipo, metadata
    INTO v_alvo
  FROM public.mensagens
  WHERE id = p_mensagem_alvo_id;

  IF v_alvo.id IS NULL THEN
    RAISE EXCEPTION 'Mensagem não encontrada';
  END IF;

  -- Precisa ser participante ativo da conversa da mensagem alvo
  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
     WHERE conversa_id = v_alvo.conversa_id
       AND usuario_id = v_uid
       AND saiu_em IS NULL
  ) THEN
    RAISE EXCEPTION 'Você não participa desta conversa';
  END IF;

  -- Autorização: autor da mensagem OU solicitante da aprovação vinculada
  v_aprovacao_id := NULLIF((v_alvo.metadata->>'aprovacao_id'), '')::uuid;
  IF v_aprovacao_id IS NOT NULL THEN
    SELECT solicitante_id INTO v_solicitante
    FROM public.aprovacoes_chat
    WHERE id = v_aprovacao_id;
  END IF;

  IF v_alvo.remetente_id <> v_uid AND COALESCE(v_solicitante, '00000000-0000-0000-0000-000000000000'::uuid) <> v_uid THEN
    RAISE EXCEPTION 'Apenas o autor da mensagem ou o solicitante da aprovação pode chamar atenção.';
  END IF;

  -- Permissão geral de urgente (default true)
  SELECT COALESCE(pode_enviar_urgente, true) INTO v_permitido
  FROM public.user_chat_permissions WHERE user_id = v_uid;
  IF v_permitido IS NULL THEN v_permitido := true; END IF;
  IF NOT v_permitido THEN
    RAISE EXCEPTION 'Seu envio de mensagens urgentes foi restringido pelo administrador.';
  END IF;

  -- Limite: 3 urgentes/hora
  SELECT COUNT(*) INTO v_count
  FROM public.mensagens
  WHERE remetente_id = v_uid
    AND tipo = 'urgente'
    AND created_at > now() - interval '1 hour';
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Limite atingido: máximo de 3 mensagens urgentes por hora.';
  END IF;

  v_conteudo := 'Chamando atenção para esta mensagem.';

  INSERT INTO public.mensagens (
    conversa_id, remetente_id, conteudo, tipo, responde_a_id, metadata
  ) VALUES (
    v_alvo.conversa_id,
    v_uid,
    v_conteudo,
    'urgente',
    v_alvo.id,
    jsonb_build_object(
      'urgente', true,
      'cutucada', true,
      'alvo_id', v_alvo.id,
      'aprovacao_id', v_aprovacao_id,
      'motivo', trim(p_motivo),
      'enviada_em', now()
    )
  )
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cutucar_mensagem(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cutucar_mensagem(uuid, text) TO authenticated;