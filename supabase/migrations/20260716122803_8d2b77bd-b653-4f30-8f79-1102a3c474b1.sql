CREATE OR REPLACE FUNCTION public.add_conversa_participante_if_missing(_conversa_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_access boolean := false;
BEGIN
  IF v_uid IS NULL OR _conversa_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.conversas_participantes cp
    WHERE cp.conversa_id = _conversa_id
      AND cp.usuario_id = v_uid
      AND cp.saiu_em IS NULL
  ) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.suporte_tickets t
    LEFT JOIN public.projeto_tarefas pt ON pt.id = t.projeto_tarefa_id
    WHERE t.conversa_id = _conversa_id
      AND (
        t.owner_id = v_uid
        OR t.requester_id = v_uid
        OR t.assignee_id = v_uid
        OR public.is_suporte_staff(v_uid)
        OR EXISTS (
          SELECT 1
          FROM public.suporte_fila_agentes fa
          WHERE fa.fila_id = t.fila_id
            AND fa.user_id = v_uid
        )
        OR pt.criador_id = v_uid
        OR pt.responsavel_id = v_uid
        OR EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_responsaveis r
          WHERE r.tarefa_id = pt.id
            AND r.user_id = v_uid
        )
        OR EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_colaboradores c
          WHERE c.tarefa_id = pt.id
            AND c.user_id = v_uid
        )
        OR EXISTS (
          SELECT 1
          FROM public.projeto_tarefa_seguidores s
          WHERE s.tarefa_id = pt.id
            AND s.user_id = v_uid
        )
      )
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN false;
  END IF;

  INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel, entrou_em)
  VALUES (_conversa_id, v_uid, 'observador', now())
  ON CONFLICT (conversa_id, usuario_id)
    DO UPDATE SET
      saiu_em = NULL,
      papel = COALESCE(public.conversas_participantes.papel, 'observador');

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_conversa_participante_if_missing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_conversa_participante_if_missing(uuid) TO authenticated;