
-- 1. Adicionar coluna mentions
ALTER TABLE public.projeto_chat_messages
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

ALTER TABLE public.process_chat_messages
  ADD COLUMN IF NOT EXISTS mentions uuid[] NOT NULL DEFAULT '{}';

-- 2. Trigger function: chat geral do projeto
CREATE OR REPLACE FUNCTION public.notify_projeto_chat_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_autor_nome TEXT;
  v_projeto_nome TEXT;
  v_mentioned UUID;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_autor_nome FROM public.profiles WHERE id = NEW.user_id LIMIT 1;
  SELECT nome INTO v_projeto_nome FROM public.projetos WHERE id = NEW.projeto_id LIMIT 1;

  FOREACH v_mentioned IN ARRAY NEW.mentions LOOP
    IF v_mentioned IS NULL OR v_mentioned = NEW.user_id THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (
      v_mentioned,
      'chat_mention',
      'Você foi mencionado no chat',
      COALESCE(v_autor_nome, 'Alguém') || ' mencionou você no chat do projeto ' || COALESCE(v_projeto_nome, ''),
      '/projetos/' || NEW.projeto_id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_projeto_chat_mentions ON public.projeto_chat_messages;
CREATE TRIGGER trg_notify_projeto_chat_mentions
AFTER INSERT ON public.projeto_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_projeto_chat_mentions();

-- 3. Trigger function: chat do processo
CREATE OR REPLACE FUNCTION public.notify_process_chat_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_autor_nome TEXT;
  v_mentioned UUID;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_autor_nome FROM public.profiles WHERE id = NEW.user_id LIMIT 1;

  FOREACH v_mentioned IN ARRAY NEW.mentions LOOP
    IF v_mentioned IS NULL OR v_mentioned = NEW.user_id THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (
      v_mentioned,
      'process_mention',
      'Você foi mencionado no chat do processo',
      COALESCE(v_autor_nome, NEW.user_nome, 'Alguém') || ' mencionou você no chat de um processo',
      '/processos/' || NEW.process_id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_process_chat_mentions ON public.process_chat_messages;
CREATE TRIGGER trg_notify_process_chat_mentions
AFTER INSERT ON public.process_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_process_chat_mentions();
