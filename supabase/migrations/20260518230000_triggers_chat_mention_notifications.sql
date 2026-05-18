-- =========================================================================
-- Triggers de notificação de @ menção nos 2 chats
-- =========================================================================
--
-- Chat corporativo (public.mensagens) e chat de submissão China
-- (public.china_chat_mensagens) hoje têm campo de menções (uuid[] e
-- jsonb respectivamente) mas NÃO disparam linha em public.notifications.
-- Resultado: o sino de menções no header (MencoesBell) nunca acende
-- pra esses chats, e o usuário mencionado não fica sabendo.
--
-- O chat IA do projeto (public.projeto_chat_messages) já tem trigger
-- (`notify_projeto_chat_mentions` desde 2026-05-08) — esta migration
-- replica o mesmo padrão pros 2 chats que faltavam.

-- =========================================================================
-- 1) Chat corporativo (public.mensagens) — `mencoes` é uuid[]
-- =========================================================================

CREATE OR REPLACE FUNCTION public.notify_chat_corporativo_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mentioned     uuid;
  v_autor_nome    text;
  v_conv_nome     text;
  v_conv_tipo     text;
  v_msg           text;
BEGIN
  IF NEW.mencoes IS NULL OR array_length(NEW.mencoes, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_autor_nome FROM public.profiles WHERE id = NEW.remetente_id LIMIT 1;
  SELECT nome, tipo INTO v_conv_nome, v_conv_tipo
    FROM public.conversas WHERE id = NEW.conversa_id LIMIT 1;

  FOREACH v_mentioned IN ARRAY NEW.mencoes LOOP
    IF v_mentioned IS NULL OR v_mentioned = NEW.remetente_id THEN
      CONTINUE;
    END IF;

    v_msg := COALESCE(v_autor_nome, 'Alguém') || ' mencionou você ' ||
      CASE
        WHEN v_conv_tipo IN ('grupo', 'group') AND v_conv_nome IS NOT NULL
          THEN 'no grupo ' || v_conv_nome
        WHEN v_conv_tipo IN ('grupo', 'group')
          THEN 'em um grupo'
        ELSE 'em uma conversa'
      END;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_mentioned, 'chat_mention', 'Você foi mencionado no chat', v_msg, '/chat');
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_chat_corporativo_mentions ON public.mensagens;
CREATE TRIGGER trg_notify_chat_corporativo_mentions
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.notify_chat_corporativo_mentions();

-- =========================================================================
-- 2) Chat de submissão China (public.china_chat_mensagens) — `mencoes` é jsonb
--    Formato esperado: [{ user_id: "...", nome: "..." }, ...]
-- =========================================================================

CREATE OR REPLACE FUNCTION public.notify_china_chat_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_men_item        jsonb;
  v_mentioned_id    uuid;
  v_produto_codigo  text;
  v_produto_nome    text;
  v_msg             text;
BEGIN
  IF NEW.mencoes IS NULL OR jsonb_array_length(NEW.mencoes) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT produto_codigo, produto_nome
    INTO v_produto_codigo, v_produto_nome
    FROM public.china_produto_submissoes WHERE id = NEW.submissao_id LIMIT 1;

  FOR v_men_item IN SELECT * FROM jsonb_array_elements(NEW.mencoes) LOOP
    -- O array pode vir como [{user_id,nome}] ou como ["uuid"] dependendo
    -- da versão do código frontend. Tentamos extrair de ambas.
    v_mentioned_id := NULL;
    IF jsonb_typeof(v_men_item) = 'object' THEN
      BEGIN
        v_mentioned_id := (v_men_item->>'user_id')::uuid;
      EXCEPTION WHEN OTHERS THEN v_mentioned_id := NULL;
      END;
    ELSIF jsonb_typeof(v_men_item) = 'string' THEN
      BEGIN
        v_mentioned_id := (v_men_item #>> '{}')::uuid;
      EXCEPTION WHEN OTHERS THEN v_mentioned_id := NULL;
      END;
    END IF;

    IF v_mentioned_id IS NULL OR v_mentioned_id = NEW.usuario_id THEN
      CONTINUE;
    END IF;

    v_msg := COALESCE(NEW.usuario_nome, 'Alguém') || ' mencionou você no chat da submissão' ||
      CASE
        WHEN v_produto_codigo IS NOT NULL
          THEN ' ' || v_produto_codigo || COALESCE(' — ' || v_produto_nome, '')
        ELSE ''
      END;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_mentioned_id, 'china_chat_mention', 'Você foi mencionado no chat China', v_msg, '/chat');
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_china_chat_mentions ON public.china_chat_mensagens;
CREATE TRIGGER trg_notify_china_chat_mentions
AFTER INSERT ON public.china_chat_mensagens
FOR EACH ROW EXECUTE FUNCTION public.notify_china_chat_mentions();
