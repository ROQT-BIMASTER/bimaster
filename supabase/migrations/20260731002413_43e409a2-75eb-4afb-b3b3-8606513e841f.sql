CREATE OR REPLACE FUNCTION public.rpc_tarefa_historico_acoes_chat(p_tarefa_id uuid, p_limit int DEFAULT 30)
RETURNS TABLE (
  id uuid,
  tipo text,
  titulo text,
  detalhe text,
  status text,
  created_at timestamptz,
  usuario_id uuid,
  usuario_nome text,
  usuario_avatar text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT c.id INTO v_conv
  FROM public.conversas c
  WHERE c.vinculo_tipo = 'tarefa' AND c.vinculo_id = p_tarefa_id
  LIMIT 1;

  IF v_conv IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = v_conv AND cp.usuario_id = v_uid AND cp.saiu_em IS NULL
  ) AND NOT public.has_role(v_uid, 'admin'::public.app_role) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM (
    SELECT
      a.id,
      'aprovacao'::text AS tipo,
      COALESCE(NULLIF(a.titulo, ''), 'Solicitação de aprovação')::text AS titulo,
      a.descricao::text AS detalhe,
      COALESCE(a.status, 'pendente')::text AS status,
      a.created_at,
      a.solicitante_id AS usuario_id,
      p.nome::text AS usuario_nome,
      p.avatar_url::text AS usuario_avatar
    FROM public.chat_aprovacoes a
    LEFT JOIN public.profiles p ON p.id = a.solicitante_id
    WHERE a.conversa_id = v_conv

    UNION ALL

    SELECT
      m.id,
      'urgente'::text AS tipo,
      'Chamada de atenção'::text AS titulo,
      COALESCE(m.metadata->>'motivo', m.conteudo)::text AS detalhe,
      NULL::text AS status,
      m.created_at,
      m.remetente_id AS usuario_id,
      p2.nome::text AS usuario_nome,
      p2.avatar_url::text AS usuario_avatar
    FROM public.mensagens m
    LEFT JOIN public.profiles p2 ON p2.id = m.remetente_id
    WHERE m.conversa_id = v_conv
      AND m.tipo = 'urgente'
      AND m.excluida_em IS NULL
  ) t
  ORDER BY t.created_at DESC
  LIMIT GREATEST(COALESCE(p_limit, 30), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_tarefa_historico_acoes_chat(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_tarefa_historico_acoes_chat(uuid, int) TO authenticated;