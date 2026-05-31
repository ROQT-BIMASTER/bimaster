ALTER TABLE public.chat_aprovacoes
  ADD COLUMN IF NOT EXISTS decidido_ip         text,
  ADD COLUMN IF NOT EXISTS decidido_user_agent text;

CREATE OR REPLACE FUNCTION public.rpc_chat_aprovacao_decidir(
  p_aprovacao_id uuid,
  p_status       text,
  p_motivo       text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_conv_id       uuid;
  v_solic_id      uuid;
  v_status_atual  text;
  v_titulo        text;
  v_conteudo      text;
  v_ip            text;
  v_ua            text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_status NOT IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'status deve ser aprovado ou rejeitado';
  END IF;

  SELECT conversa_id, solicitante_id, status, titulo
    INTO v_conv_id, v_solic_id, v_status_atual, v_titulo
  FROM public.chat_aprovacoes WHERE id = p_aprovacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'aprovacao nao encontrada'; END IF;
  IF v_status_atual <> 'pendente' THEN
    RAISE EXCEPTION 'aprovacao ja decidida (status: %)', v_status_atual;
  END IF;
  IF v_uid = v_solic_id THEN
    RAISE EXCEPTION 'voce nao pode decidir sua propria solicitacao';
  END IF;

  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
    WHERE conversa_id = v_conv_id AND usuario_id = v_uid AND saiu_em IS NULL
  ) THEN RAISE EXCEPTION 'sem acesso'; END IF;

  v_ip := nullif(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1), '');
  v_ua := current_setting('request.headers', true)::json ->> 'user-agent';

  UPDATE public.chat_aprovacoes
     SET status = p_status,
         decidido_por = v_uid,
         decidido_em = now(),
         motivo = NULLIF(trim(coalesce(p_motivo, '')), ''),
         decidido_ip = v_ip,
         decidido_user_agent = v_ua
   WHERE id = p_aprovacao_id;

  IF p_status = 'aprovado' THEN
    UPDATE public.chat_aprovacao_documentos
       SET status = 'assinado',
           assinado_por = v_uid,
           assinado_em = now()
     WHERE aprovacao_id = p_aprovacao_id;
  END IF;

  v_conteudo :=
    CASE WHEN p_status = 'aprovado' THEN '✅ Aprovou: ' ELSE '❌ Rejeitou: ' END
    || v_titulo
    || COALESCE(E'\n\nMotivo: ' || p_motivo, '');

  INSERT INTO public.mensagens (
    conversa_id, remetente_id, conteudo, tipo, metadata
  ) VALUES (
    v_conv_id, v_uid, v_conteudo, 'sistema',
    jsonb_build_object(
      'aprovacao_decisao_id', p_aprovacao_id::text,
      'status', p_status
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_chat_aprovacao_decidir(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_chat_aprovacao_decidir(uuid, text, text) TO authenticated;

COMMENT ON FUNCTION public.rpc_chat_aprovacao_decidir IS
  'Aprova ou rejeita; registra IP/user-agent (assinatura eletronica simples) e marca documentos como assinado quando aprovado.';