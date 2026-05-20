-- Garante extensão pg_net para chamadas HTTP assíncronas
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Função: dispara push para participantes da conversa quando há nova mensagem
CREATE OR REPLACE FUNCTION public.trg_push_on_mensagem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_anon text;
  v_payload jsonb;
BEGIN
  v_url  := current_setting('app.supabase_url', true);
  v_anon := current_setting('app.supabase_anon_key', true);

  -- Fallback hardcoded (project ref público)
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://aokkyrgaqjarhlywhjju.supabase.co';
  END IF;

  v_payload := jsonb_build_object(
    'event', 'mensagem',
    'mensagem_id', NEW.id,
    'conversa_id', NEW.conversa_id,
    'autor_id', NEW.user_id,
    'preview', left(coalesce(NEW.conteudo, ''), 140)
  );

  PERFORM extensions.http_post(
    url := v_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_anon, '')
    ),
    body := v_payload::text,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear o INSERT por causa de push
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_on_mensagem ON public.mensagens;
CREATE TRIGGER push_on_mensagem
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.trg_push_on_mensagem();

-- Função: dispara push quando há nova notificação (menção / urgente)
CREATE OR REPLACE FUNCTION public.trg_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_anon text;
  v_payload jsonb;
BEGIN
  IF NEW.tipo NOT IN ('chat_mention','chat_urgent','task_mention','project_mention') THEN
    RETURN NEW;
  END IF;

  v_url  := current_setting('app.supabase_url', true);
  v_anon := current_setting('app.supabase_anon_key', true);
  IF v_url IS NULL OR v_url = '' THEN
    v_url := 'https://aokkyrgaqjarhlywhjju.supabase.co';
  END IF;

  v_payload := jsonb_build_object(
    'event', 'notification',
    'notification_id', NEW.id,
    'user_id', NEW.user_id,
    'tipo', NEW.tipo,
    'titulo', NEW.titulo,
    'mensagem', NEW.mensagem
  );

  PERFORM extensions.http_post(
    url := v_url || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_anon, '')
    ),
    body := v_payload::text,
    timeout_milliseconds := 5000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_on_notification ON public.notifications;
CREATE TRIGGER push_on_notification
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_push_on_notification();