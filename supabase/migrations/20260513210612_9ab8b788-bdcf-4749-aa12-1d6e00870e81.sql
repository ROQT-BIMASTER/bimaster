CREATE OR REPLACE FUNCTION public.rpc_chat_criar_conversa_privada(p_outro_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conversa_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  IF p_outro_user_id IS NULL OR p_outro_user_id = v_uid THEN
    RAISE EXCEPTION 'usuário inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_outro_user_id
      AND p.status = 'ativo'
      AND p.is_honeytoken = false
  ) THEN
    RAISE EXCEPTION 'usuário indisponível';
  END IF;

  SELECT cp1.conversa_id
    INTO v_conversa_id
  FROM public.conversas_participantes cp1
  JOIN public.conversas_participantes cp2
    ON cp2.conversa_id = cp1.conversa_id
   AND cp2.usuario_id = p_outro_user_id
   AND cp2.saiu_em IS NULL
  JOIN public.conversas c
    ON c.id = cp1.conversa_id
  WHERE cp1.usuario_id = v_uid
    AND cp1.saiu_em IS NULL
    AND c.tipo IN ('privada', 'private')
    AND (
      SELECT count(*)
      FROM public.conversas_participantes cp_count
      WHERE cp_count.conversa_id = cp1.conversa_id
        AND cp_count.saiu_em IS NULL
    ) = 2
  ORDER BY c.updated_at DESC
  LIMIT 1;

  IF v_conversa_id IS NOT NULL THEN
    RETURN v_conversa_id;
  END IF;

  INSERT INTO public.conversas (tipo, criado_por)
  VALUES ('privada', v_uid)
  RETURNING id INTO v_conversa_id;

  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
  VALUES
    (v_conversa_id, v_uid, 'membro'),
    (v_conversa_id, p_outro_user_id, 'membro')
  ON CONFLICT (conversa_id, usuario_id) DO UPDATE
    SET saiu_em = NULL,
        entrou_em = now();

  RETURN v_conversa_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_chat_criar_conversa_privada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_chat_criar_conversa_privada(uuid) TO authenticated;