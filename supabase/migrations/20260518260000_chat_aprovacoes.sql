-- =========================================================================
-- chat_aprovacoes — pedidos de aprovação inline no chat corporativo
-- =========================================================================
--
-- Diferencial do bimaster: enviar pedido de aprovação como mensagem
-- especial no chat e qualquer participante decidir com botões inline.
-- NÃO usa fluxo_aprovacao_* (que é mais elaborado, com etapas/lotes) —
-- escopo simples: 1 solicitante, qualquer participante decide, registro
-- imutável após decisão.
--
-- Cada pedido gera 1 mensagem 'sistema' com metadata.aprovacao_id. O
-- MessageBubble renderiza essa mensagem como card de aprovação em vez
-- do balão normal. Quando alguém decide, uma 2ª mensagem é criada com
-- metadata.aprovacao_decisao_id + status pra rastreabilidade.

CREATE TABLE IF NOT EXISTS public.chat_aprovacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id     uuid NOT NULL REFERENCES public.conversas(id) ON DELETE CASCADE,
  mensagem_id     uuid REFERENCES public.mensagens(id) ON DELETE SET NULL,
  solicitante_id  uuid NOT NULL,
  titulo          text NOT NULL CHECK (length(trim(titulo)) > 0),
  descricao       text,
  status          text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovado', 'rejeitado', 'cancelado')),
  decidido_por    uuid,
  decidido_em     timestamptz,
  motivo          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_aprovacoes_conversa
  ON public.chat_aprovacoes (conversa_id, created_at DESC);

ALTER TABLE public.chat_aprovacoes ENABLE ROW LEVEL SECURITY;

-- SELECT: participantes ativos da conversa
DROP POLICY IF EXISTS chat_aprovacoes_select ON public.chat_aprovacoes;
CREATE POLICY chat_aprovacoes_select ON public.chat_aprovacoes
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversas_participantes cp
    WHERE cp.conversa_id = chat_aprovacoes.conversa_id
      AND cp.usuario_id = auth.uid()
      AND cp.saiu_em IS NULL
  )
);

-- INSERT/UPDATE só via RPCs (service_role bypassa RLS).
-- Não criamos policy pra clients autenticados — evita gravação direta.

-- Realtime — para atualizar UI quando outro user decide
ALTER TABLE public.chat_aprovacoes REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_aprovacoes;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- =========================================================================
-- RPC: criar pedido de aprovação
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rpc_chat_aprovacao_criar(
  p_conversa_id uuid,
  p_titulo      text,
  p_descricao   text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_id      uuid;
  v_msg_id  uuid;
  v_titulo  text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  v_titulo := trim(coalesce(p_titulo, ''));
  IF v_titulo = '' THEN RAISE EXCEPTION 'titulo obrigatorio'; END IF;
  IF length(v_titulo) > 200 THEN v_titulo := substring(v_titulo from 1 for 200); END IF;

  -- valida participação
  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
    WHERE conversa_id = p_conversa_id AND usuario_id = v_uid AND saiu_em IS NULL
  ) THEN RAISE EXCEPTION 'sem acesso a conversa'; END IF;

  -- cria aprovação
  INSERT INTO public.chat_aprovacoes (conversa_id, solicitante_id, titulo, descricao)
  VALUES (p_conversa_id, v_uid, v_titulo, NULLIF(trim(coalesce(p_descricao, '')), ''))
  RETURNING id INTO v_id;

  -- cria mensagem 'sistema' apontando pra aprovação
  INSERT INTO public.mensagens (
    conversa_id, remetente_id, conteudo, tipo, metadata
  ) VALUES (
    p_conversa_id, v_uid,
    '📋 Pedido de aprovação: ' || v_titulo,
    'sistema',
    jsonb_build_object('aprovacao_id', v_id::text)
  )
  RETURNING id INTO v_msg_id;

  -- vincula mensagem na aprovação
  UPDATE public.chat_aprovacoes SET mensagem_id = v_msg_id WHERE id = v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_chat_aprovacao_criar(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_chat_aprovacao_criar(uuid, text, text) TO authenticated;

-- =========================================================================
-- RPC: decidir (aprovar ou rejeitar)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.rpc_chat_aprovacao_decidir(
  p_aprovacao_id uuid,
  p_status       text,   -- 'aprovado' ou 'rejeitado'
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

  -- valida participação
  IF NOT EXISTS (
    SELECT 1 FROM public.conversas_participantes
    WHERE conversa_id = v_conv_id AND usuario_id = v_uid AND saiu_em IS NULL
  ) THEN RAISE EXCEPTION 'sem acesso'; END IF;

  UPDATE public.chat_aprovacoes
     SET status = p_status,
         decidido_por = v_uid,
         decidido_em = now(),
         motivo = NULLIF(trim(coalesce(p_motivo, '')), '')
   WHERE id = p_aprovacao_id;

  -- cria mensagem informando decisão
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

COMMENT ON TABLE  public.chat_aprovacoes IS
  'Pedidos de aprovacao inline do chat corporativo. Status pendente | aprovado | rejeitado | cancelado.';
COMMENT ON FUNCTION public.rpc_chat_aprovacao_criar    IS 'Cria pedido + mensagem sistema com metadata.aprovacao_id';
COMMENT ON FUNCTION public.rpc_chat_aprovacao_decidir IS 'Aprova ou rejeita; cria mensagem sistema de decisao';
