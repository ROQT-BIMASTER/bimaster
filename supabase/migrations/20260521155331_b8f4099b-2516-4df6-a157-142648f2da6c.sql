
ALTER TABLE public.briefing_membros
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.rpc_briefing_marcar_lido(p_briefing_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.briefing_membros
     SET last_read_at = now()
   WHERE briefing_id = p_briefing_id AND user_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_briefing_marcar_lido(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rpc_briefing_marcar_lido(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_briefing_comentario_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mentioned   uuid;
  v_autor_nome  text;
  v_brief_tit   text;
  v_msg         text;
  v_url         text;
BEGIN
  IF NEW.mentions IS NULL OR array_length(NEW.mentions, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_autor_nome FROM public.profiles WHERE id = NEW.author_id LIMIT 1;
  SELECT titulo INTO v_brief_tit FROM public.briefings WHERE id = NEW.briefing_id LIMIT 1;

  v_url := '/dashboard/briefings/' || NEW.briefing_id::text
        || '?campo=' || NEW.campo_key
        || '&comentario=' || NEW.id::text;

  FOREACH v_mentioned IN ARRAY NEW.mentions LOOP
    IF v_mentioned IS NULL OR v_mentioned = NEW.author_id THEN
      CONTINUE;
    END IF;

    v_msg := COALESCE(v_autor_nome, 'Alguém') || ' mencionou você em um comentário'
          || COALESCE(' no briefing ' || v_brief_tit, '');

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_mentioned, 'briefing_mention', 'Você foi mencionado em um briefing', v_msg, v_url);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_briefing_comentario_mentions ON public.briefing_comentarios;
CREATE TRIGGER trg_notify_briefing_comentario_mentions
AFTER INSERT ON public.briefing_comentarios
FOR EACH ROW EXECUTE FUNCTION public.notify_briefing_comentario_mentions();
