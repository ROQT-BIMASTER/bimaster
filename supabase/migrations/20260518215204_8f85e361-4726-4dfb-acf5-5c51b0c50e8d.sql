-- Corrige action_url das notificações de menção para apontar para a rota
-- real (/dashboard/projetos/:id) e incluir tarefa/comentário/mensagem.

CREATE OR REPLACE FUNCTION public.notify_task_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_autor_nome TEXT;
  v_tarefa RECORD;
  v_projeto_id UUID;
  v_projeto_nome TEXT;
  v_mentioned UUID;
  v_url TEXT;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_autor_nome FROM public.profiles WHERE id = NEW.user_id LIMIT 1;

  SELECT t.id, t.titulo, t.secao_id INTO v_tarefa
  FROM public.projeto_tarefas t WHERE t.id = NEW.tarefa_id LIMIT 1;

  SELECT p.id, p.nome INTO v_projeto_id, v_projeto_nome
  FROM public.projetos p
  JOIN public.projeto_secoes ps ON ps.projeto_id = p.id
  WHERE ps.id = v_tarefa.secao_id LIMIT 1;

  FOREACH v_mentioned IN ARRAY NEW.mentions LOOP
    IF v_mentioned IS NULL OR v_mentioned = NEW.user_id THEN
      CONTINUE;
    END IF;

    v_url := CASE
      WHEN v_projeto_id IS NOT NULL THEN
        '/dashboard/projetos/' || v_projeto_id::text
        || '?tarefa=' || v_tarefa.id::text
        || '&comentario=' || NEW.id::text
      ELSE NULL
    END;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (
      v_mentioned,
      'task_mention',
      'Você foi mencionado em um comentário',
      COALESCE(v_autor_nome, 'Alguém') || ' mencionou você em "' || LEFT(COALESCE(v_tarefa.titulo,''), 60) || '"' ||
        CASE WHEN v_projeto_nome IS NOT NULL THEN ' no projeto ' || v_projeto_nome ELSE '' END,
      v_url
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_projeto_chat_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_autor_nome TEXT;
  v_projeto_nome TEXT;
  v_mentioned UUID;
  v_msg TEXT;
  v_url TEXT;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_autor_nome FROM public.profiles WHERE id = NEW.user_id LIMIT 1;
  SELECT nome INTO v_projeto_nome FROM public.projetos WHERE id = NEW.projeto_id LIMIT 1;

  v_msg := COALESCE(v_autor_nome, 'Alguém')
    || ' mencionou você no chat'
    || CASE WHEN v_projeto_nome IS NOT NULL THEN ' do projeto ' || v_projeto_nome ELSE '' END
    || ': "' || LEFT(COALESCE(NEW.conteudo, ''), 120) || '"';

  v_url := '/dashboard/projetos/' || NEW.projeto_id::text
    || '?tab=chat&mensagem=' || NEW.id::text;

  FOREACH v_mentioned IN ARRAY NEW.mentions LOOP
    IF v_mentioned IS NULL OR v_mentioned = NEW.user_id THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_mentioned, 'chat_mention', 'Você foi mencionado no chat', v_msg, v_url);
  END LOOP;

  RETURN NEW;
END;
$function$;