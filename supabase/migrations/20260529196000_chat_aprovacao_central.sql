-- =========================================================================
-- Central de Aprovações (leve) — aprovações do chat encaminhadas p/ revisão
-- =========================================================================
--
-- FASE 3 da feature "documentos + assinatura em aprovações do chat".
--
-- Acrescenta a opção de, ao solicitar uma aprovação, encaminhá-la para uma
-- "Central de Aprovações" global (uma fila/Kanban sobre chat_aprovacoes), em
-- vez de só deixar o card decidível no chat. O encaminhamento é só um flag
-- (enviado_central) — a aprovação continua sendo a mesma linha de
-- chat_aprovacoes, decidida pelas RPCs existentes.
--
-- Também ajusta as policies de SELECT de chat_aprovacoes e
-- chat_aprovacao_documentos para que ADMIN enxergue tudo (necessário para a
-- Central global e para o módulo de documentos). Participantes continuam
-- vendo o que já viam.

-- 1) Flag de encaminhamento
ALTER TABLE public.chat_aprovacoes
  ADD COLUMN IF NOT EXISTS enviado_central    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enviado_central_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_chat_aprovacoes_central
  ON public.chat_aprovacoes (enviado_central, status, created_at DESC)
  WHERE enviado_central;

-- 2) RPC: encaminhar uma aprovação para a Central
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

  -- só o solicitante (ou admin) pode encaminhar
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
  'Marca uma aprovação do chat como encaminhada para a Central de Aprovações (flag enviado_central). Solicitante ou admin.';

-- 3) SELECT policies — admin enxerga tudo (Central global + módulo de docs)
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
