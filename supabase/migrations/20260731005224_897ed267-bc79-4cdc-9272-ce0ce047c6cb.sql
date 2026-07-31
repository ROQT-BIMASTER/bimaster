CREATE TABLE IF NOT EXISTS public.chat_acoes_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao text NOT NULL CHECK (acao IN ('aprovacao','urgente')),
  fase text NOT NULL CHECK (fase IN ('iniciada','concluida','falhou')),
  entidade_tipo text NOT NULL CHECK (entidade_tipo IN ('briefing','projeto','submissao','tarefa','processo','prospect','conversa')),
  entidade_id uuid,
  conversa_id uuid,
  referencia_id uuid,
  detalhe text,
  erro text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.chat_acoes_auditoria TO authenticated;
GRANT ALL ON public.chat_acoes_auditoria TO service_role;

ALTER TABLE public.chat_acoes_auditoria ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_chat_acoes_aud_entidade
  ON public.chat_acoes_auditoria (entidade_tipo, entidade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_acoes_aud_conversa
  ON public.chat_acoes_auditoria (conversa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_acoes_aud_user
  ON public.chat_acoes_auditoria (user_id, created_at DESC);

DROP POLICY IF EXISTS "chat_acoes_aud_insert_own" ON public.chat_acoes_auditoria;
CREATE POLICY "chat_acoes_aud_insert_own"
  ON public.chat_acoes_auditoria FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "chat_acoes_aud_select" ON public.chat_acoes_auditoria;
CREATE POLICY "chat_acoes_aud_select"
  ON public.chat_acoes_auditoria FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (conversa_id IS NOT NULL AND conversa_id IN (
      SELECT cp.conversa_id FROM public.conversas_participantes cp WHERE cp.usuario_id = auth.uid()
    ))
  );

CREATE OR REPLACE FUNCTION public.rpc_registrar_acao_chat_auditoria(
  p_acao text,
  p_fase text,
  p_entidade_tipo text,
  p_entidade_id uuid DEFAULT NULL,
  p_conversa_id uuid DEFAULT NULL,
  p_referencia_id uuid DEFAULT NULL,
  p_detalhe text DEFAULT NULL,
  p_erro text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacao obrigatoria';
  END IF;

  INSERT INTO public.chat_acoes_auditoria (
    acao, fase, entidade_tipo, entidade_id, conversa_id,
    referencia_id, detalhe, erro, metadata, user_id
  ) VALUES (
    p_acao, p_fase, p_entidade_tipo, p_entidade_id, p_conversa_id,
    p_referencia_id, left(coalesce(p_detalhe, ''), 500), left(coalesce(p_erro, ''), 500),
    coalesce(p_metadata, '{}'::jsonb), auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_registrar_acao_chat_auditoria(text,text,text,uuid,uuid,uuid,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_chat_acoes_auditoria_historico(
  p_entidade_tipo text,
  p_entidade_id uuid,
  p_limit integer DEFAULT 100
) RETURNS TABLE (
  id uuid,
  acao text,
  fase text,
  entidade_tipo text,
  entidade_id uuid,
  conversa_id uuid,
  referencia_id uuid,
  detalhe text,
  erro text,
  metadata jsonb,
  user_id uuid,
  user_nome text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.acao, a.fase, a.entidade_tipo, a.entidade_id, a.conversa_id,
         a.referencia_id, a.detalhe, a.erro, a.metadata, a.user_id,
         COALESCE(p.nome, p.email, 'Usuário'),
         a.created_at
  FROM public.chat_acoes_auditoria a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE a.entidade_tipo = p_entidade_tipo
    AND a.entidade_id = p_entidade_id
    AND (
      a.user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR (a.conversa_id IS NOT NULL AND a.conversa_id IN (
        SELECT cp.conversa_id FROM public.conversas_participantes cp WHERE cp.usuario_id = auth.uid()
      ))
    )
  ORDER BY a.created_at DESC
  LIMIT COALESCE(p_limit, 100);
$$;

GRANT EXECUTE ON FUNCTION public.rpc_chat_acoes_auditoria_historico(text,uuid,integer) TO authenticated;