
-- 1. Vínculo em conversas
ALTER TABLE public.conversas
  ADD COLUMN IF NOT EXISTS vinculo_tipo text,
  ADD COLUMN IF NOT EXISTS vinculo_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='conversas_vinculo_tipo_check') THEN
    ALTER TABLE public.conversas
      ADD CONSTRAINT conversas_vinculo_tipo_check
      CHECK (vinculo_tipo IS NULL OR vinculo_tipo IN ('briefing','projeto','submissao'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS conversas_vinculo_uniq
  ON public.conversas (vinculo_tipo, vinculo_id)
  WHERE vinculo_tipo IS NOT NULL;

-- 2. RPC get-or-create conversa vinculada
CREATE OR REPLACE FUNCTION public.rpc_get_or_create_conversa_vinculada(
  p_tipo text,
  p_ref_id uuid,
  p_titulo text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_tipo NOT IN ('briefing','projeto','submissao') THEN
    RAISE EXCEPTION 'invalid vinculo_tipo: %', p_tipo;
  END IF;
  IF p_ref_id IS NULL THEN
    RAISE EXCEPTION 'ref_id required';
  END IF;

  -- Conversa existente?
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

    -- Criador como admin
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    VALUES (v_conv, v_uid, 'admin')
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;

    -- Adiciona participantes conforme escopo
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
    ELSIF p_tipo = 'submissao' THEN
      -- created_by + reviewed_by (se houver)
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
  ELSE
    -- Já existe — garante que o caller é participante
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    VALUES (v_conv, v_uid, 'membro')
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  END IF;

  RETURN v_conv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_get_or_create_conversa_vinculada(text, uuid, text) TO authenticated, service_role;
