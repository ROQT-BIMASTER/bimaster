
-- 1) rpc_get_or_create_conversa_vinculada: re-sync participantes no ramo "existente"
CREATE OR REPLACE FUNCTION public.rpc_get_or_create_conversa_vinculada(
  p_tipo text,
  p_ref_id uuid,
  p_titulo text
)
RETURNS uuid
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
    -- Garante o caller como participante
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    VALUES (v_conv, v_uid, 'membro')
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  END IF;

  -- Re-sincroniza participantes conforme escopo (idempotente)
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
$$;

REVOKE ALL ON FUNCTION public.rpc_get_or_create_conversa_vinculada(text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_or_create_conversa_vinculada(text, uuid, text) TO authenticated, service_role;

-- 2) rpc_cutucar_item: rate-limit + garantir autor + inserir mensagem urgente
CREATE OR REPLACE FUNCTION public.rpc_cutucar_item(
  p_tipo text,
  p_ref_id uuid,
  p_titulo_escopo text,
  p_item_id uuid,
  p_item_tipo text,
  p_doc_nome text,
  p_motivo text,
  p_item_autor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_conv uuid;
  v_count int;
  v_resumo text;
  v_conteudo text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 8 THEN
    RAISE EXCEPTION 'motivo deve ter ao menos 8 caracteres';
  END IF;

  -- Rate limit: 3 urgentes/hora por remetente
  SELECT count(*) INTO v_count
  FROM public.mensagens
  WHERE remetente_id = v_uid
    AND tipo = 'urgente'
    AND created_at >= (now() - interval '1 hour');
  IF v_count >= 3 THEN
    RAISE EXCEPTION 'Limite atingido: máximo de 3 alertas urgentes por hora.';
  END IF;

  -- Garante conversa vinculada e sincroniza participantes
  v_conv := public.rpc_get_or_create_conversa_vinculada(p_tipo, p_ref_id, p_titulo_escopo);

  -- Autor do item também recebe (defensivo)
  IF p_item_autor_id IS NOT NULL AND p_item_autor_id <> v_uid THEN
    INSERT INTO public.conversas_participantes (conversa_id, usuario_id, papel)
    VALUES (v_conv, p_item_autor_id, 'membro')
    ON CONFLICT (conversa_id, usuario_id) DO NOTHING;
  END IF;

  v_resumo := COALESCE(left(btrim(p_motivo), 160), '');
  v_conteudo := 'Chamando atenção'
    || CASE WHEN p_doc_nome IS NOT NULL AND btrim(p_doc_nome) <> ''
            THEN ' no documento "' || p_doc_nome || '"' ELSE '' END
    || ': ' || v_resumo;

  INSERT INTO public.mensagens (conversa_id, remetente_id, conteudo, tipo, metadata)
  VALUES (
    v_conv,
    v_uid,
    v_conteudo,
    'urgente',
    jsonb_build_object(
      'urgente', true,
      'cutucada', true,
      'vinculo_tipo', p_tipo,
      'vinculo_ref_id', p_ref_id,
      'item_id', p_item_id,
      'item_tipo', COALESCE(p_item_tipo, 'comentario'),
      'doc_nome', p_doc_nome,
      'motivo', btrim(p_motivo),
      'enviada_em', now()
    )
  );

  RETURN v_conv;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_cutucar_item(text, uuid, text, uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_cutucar_item(text, uuid, text, uuid, text, text, text, uuid) TO authenticated, service_role;

-- 3) Trigger: bloquear delete/edit de mensagens-âncora de aprovações aprovadas
CREATE OR REPLACE FUNCTION public.tg_bloquear_edicao_aprovacao_aprovada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aprov_id uuid;
  v_status text;
BEGIN
  -- Extrai aprovacao_id do metadata (formato uuid em texto)
  v_aprov_id := NULLIF(NEW.metadata->>'aprovacao_id','')::uuid;
  IF v_aprov_id IS NULL THEN
    v_aprov_id := NULLIF(OLD.metadata->>'aprovacao_id','')::uuid;
  END IF;
  IF v_aprov_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_status
  FROM public.chat_aprovacoes
  WHERE id = v_aprov_id;

  IF v_status IS DISTINCT FROM 'aprovado' THEN
    RETURN NEW;
  END IF;

  -- É âncora de aprovação aprovada.
  -- Bloqueia soft-delete e alteração de conteúdo.
  IF (COALESCE(OLD.excluida_em, 'epoch'::timestamptz)
       IS DISTINCT FROM COALESCE(NEW.excluida_em, 'epoch'::timestamptz))
     OR (COALESCE(OLD.excluida_para_todos,false) IS DISTINCT FROM COALESCE(NEW.excluida_para_todos,false))
     OR (COALESCE(OLD.conteudo,'') IS DISTINCT FROM COALESCE(NEW.conteudo,''))
  THEN
    RAISE EXCEPTION 'Documento aprovado no chat não pode ser excluído nem editado — permanece na Central de Aprovações.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_edicao_aprovacao_aprovada ON public.mensagens;
CREATE TRIGGER trg_bloquear_edicao_aprovacao_aprovada
BEFORE UPDATE ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_edicao_aprovacao_aprovada();

-- Também bloqueia insert em mensagens_ocultas (apagar para mim) da âncora quando aprovada
CREATE OR REPLACE FUNCTION public.tg_bloquear_ocultar_aprovacao_aprovada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aprov_id uuid;
  v_status text;
BEGIN
  SELECT NULLIF(m.metadata->>'aprovacao_id','')::uuid
    INTO v_aprov_id
  FROM public.mensagens m
  WHERE m.id = NEW.mensagem_id;

  IF v_aprov_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status INTO v_status
  FROM public.chat_aprovacoes
  WHERE id = v_aprov_id;

  IF v_status = 'aprovado' THEN
    RAISE EXCEPTION 'Documento aprovado no chat não pode ser removido da sua caixa — permanece na Central de Aprovações.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_ocultar_aprovacao_aprovada ON public.mensagens_ocultas;
CREATE TRIGGER trg_bloquear_ocultar_aprovacao_aprovada
BEFORE INSERT ON public.mensagens_ocultas
FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_ocultar_aprovacao_aprovada();
