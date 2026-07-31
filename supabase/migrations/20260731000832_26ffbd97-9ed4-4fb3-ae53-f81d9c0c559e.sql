CREATE OR REPLACE FUNCTION public.rpc_get_or_create_conversa_vinculada(p_tipo text, p_ref_id uuid, p_titulo text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_tipo NOT IN ('briefing','projeto','submissao','tarefa','processo') THEN
    RAISE EXCEPTION 'invalid vinculo_tipo: %', p_tipo;
  END IF;
  IF p_ref_id IS NULL THEN
    RAISE EXCEPTION 'ref_id required';
  END IF;

  SELECT id INTO v_conv
  FROM public.conversas
  WHERE vinculo_tipo = p_tipo AND vinculo_id = p_ref_id
  LIMIT 1;

  IF v_conv IS NULL THEN
    INSERT INTO public.conversas (nome, tipo, criado_por, vinculo_tipo, vinculo_id, descricao)
    VALUES (
      COALESCE(NULLIF(p_titulo,''), 'Conversa vinculada'),
      'grupo',
      v_uid,
      p_tipo,
      p_ref_id,
      'Conversa de aprovações e alertas vinculada a ' || p_tipo
    )
    RETURNING id INTO v_conv;

    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    VALUES (v_conv, v_uid, 'admin')
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  ELSE
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    VALUES (v_conv, v_uid, 'membro')
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  END IF;

  IF p_tipo = 'briefing' THEN
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT v_conv, m.user_id, 'membro'
    FROM public.briefing_membros m
    WHERE m.briefing_id = p_ref_id
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  ELSIF p_tipo = 'projeto' THEN
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT v_conv, m.user_id, 'membro'
    FROM public.projeto_membros m
    WHERE m.projeto_id = p_ref_id
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  ELSIF p_tipo = 'tarefa' THEN
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT DISTINCT v_conv, u.user_id, 'membro'
    FROM (
      SELECT t.criador_id AS user_id FROM public.projeto_tarefas t WHERE t.id = p_ref_id
      UNION
      SELECT t.responsavel_id FROM public.projeto_tarefas t WHERE t.id = p_ref_id
      UNION
      SELECT r.user_id FROM public.projeto_tarefa_responsaveis r WHERE r.tarefa_id = p_ref_id
      UNION
      SELECT s.user_id FROM public.projeto_tarefa_seguidores s WHERE s.tarefa_id = p_ref_id
      UNION
      SELECT m.user_id
      FROM public.projeto_membros m
      JOIN public.projeto_tarefas t ON t.projeto_id = m.projeto_id
      WHERE t.id = p_ref_id
    ) u
    WHERE u.user_id IS NOT NULL
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  ELSIF p_tipo = 'submissao' THEN
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT v_conv, s.created_by, 'membro'
    FROM public.china_produto_submissoes s
    WHERE s.id = p_ref_id AND s.created_by IS NOT NULL
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    SELECT v_conv, s.reviewed_by, 'membro'
    FROM public.china_produto_submissoes s
    WHERE s.id = p_ref_id AND s.reviewed_by IS NOT NULL
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  END IF;

  RETURN v_conv;
END;
$function$;