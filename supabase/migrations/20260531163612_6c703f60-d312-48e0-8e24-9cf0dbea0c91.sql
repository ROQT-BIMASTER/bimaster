ALTER TABLE public.chat_aprovacoes
  ADD COLUMN IF NOT EXISTS enviado_central    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enviado_central_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_chat_aprovacoes_central
  ON public.chat_aprovacoes (enviado_central, status, created_at DESC)
  WHERE enviado_central;

CREATE OR REPLACE FUNCTION public.rpc_chat_aprovacao_enviar_central(
  p_aprovacao_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_conv_id uuid;
  v_solic   uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT conversa_id, solicitante_id INTO v_conv_id, v_solic
  FROM public.chat_aprovacoes WHERE id = p_aprovacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'aprovacao nao encontrada'; END IF;

  IF v_uid <> v_solic AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'sem permissao para encaminhar';
  END IF;

  UPDATE public.chat_aprovacoes
     SET enviado_central = true,
         enviado_central_em = COALESCE(enviado_central_em, now())
   WHERE id = p_aprovacao_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_chat_aprovacao_enviar_central(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_chat_aprovacao_enviar_central(uuid) TO authenticated;

COMMENT ON FUNCTION public.rpc_chat_aprovacao_enviar_central IS
  'Marca uma aprovacao do chat como encaminhada para a Central de Aprovacoes.';

DROP POLICY IF EXISTS chat_aprovacoes_select ON public.chat_aprovacoes;
CREATE POLICY chat_aprovacoes_select ON public.chat_aprovacoes
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = chat_aprovacoes.conversa_id
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);

DROP POLICY IF EXISTS chat_aprov_docs_select ON public.chat_aprovacao_documentos;
CREATE POLICY chat_aprov_docs_select ON public.chat_aprovacao_documentos
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = chat_aprovacao_documentos.conversa_id
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);