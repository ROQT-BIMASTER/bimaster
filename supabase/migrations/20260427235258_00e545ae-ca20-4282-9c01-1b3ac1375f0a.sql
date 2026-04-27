-- ============================================================
-- ONDA 2: Notificações do módulo de Projetos
-- ============================================================

-- 1) Trigger: menções em comentários de tarefas
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
    -- Não notifica o próprio autor
    IF v_mentioned IS NULL OR v_mentioned = NEW.user_id THEN
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (
      v_mentioned,
      'task_mention',
      'Você foi mencionado em um comentário',
      COALESCE(v_autor_nome, 'Alguém') || ' mencionou você em "' || LEFT(COALESCE(v_tarefa.titulo,''), 60) || '"' ||
        CASE WHEN v_projeto_nome IS NOT NULL THEN ' no projeto ' || v_projeto_nome ELSE '' END,
      CASE WHEN v_projeto_id IS NOT NULL THEN '/projetos/' || v_projeto_id::text ELSE NULL END
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_task_mentions ON public.projeto_tarefa_comentarios;
CREATE TRIGGER trg_notify_task_mentions
AFTER INSERT ON public.projeto_tarefa_comentarios
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_mentions();

-- 2) Trigger: notificação ao criador quando tarefa é concluída
CREATE OR REPLACE FUNCTION public.notify_task_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto_id UUID;
  v_projeto_nome TEXT;
  v_resp_nome TEXT;
BEGIN
  IF NEW.status <> 'concluida' OR OLD.status = 'concluida' THEN
    RETURN NEW;
  END IF;
  IF NEW.criador_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Não notifica se o próprio criador concluiu (responsável == criador)
  IF NEW.responsavel_id IS NOT NULL AND NEW.responsavel_id = NEW.criador_id THEN
    RETURN NEW;
  END IF;

  SELECT p.id, p.nome INTO v_projeto_id, v_projeto_nome
  FROM public.projetos p
  JOIN public.projeto_secoes ps ON ps.projeto_id = p.id
  WHERE ps.id = NEW.secao_id LIMIT 1;

  SELECT nome INTO v_resp_nome FROM public.profiles WHERE id = NEW.responsavel_id LIMIT 1;

  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  VALUES (
    NEW.criador_id,
    'task_assigned',
    'Tarefa concluída',
    COALESCE(v_resp_nome, 'O responsável') || ' concluiu "' || LEFT(NEW.titulo, 60) || '"' ||
      CASE WHEN v_projeto_nome IS NOT NULL THEN ' no projeto ' || v_projeto_nome ELSE '' END,
    CASE WHEN v_projeto_id IS NOT NULL THEN '/projetos/' || v_projeto_id::text ELSE NULL END
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_task_completed ON public.projeto_tarefas;
CREATE TRIGGER trg_notify_task_completed
AFTER UPDATE OF status ON public.projeto_tarefas
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_completed();

-- 3) Função: dispara avisos de prazo (3d, 1d, vencido) — idempotente por dia/tarefa/bucket
CREATE OR REPLACE FUNCTION public.notify_task_deadlines()
RETURNS TABLE(bucket TEXT, total INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_count_3 INT := 0;
  v_count_1 INT := 0;
  v_count_v INT := 0;
BEGIN
  -- 3 dias para vencer
  WITH alvo AS (
    SELECT t.id, t.titulo, t.responsavel_id, t.data_prazo,
           p.id AS projeto_id, p.nome AS projeto_nome
    FROM public.projeto_tarefas t
    JOIN public.projeto_secoes ps ON ps.id = t.secao_id
    JOIN public.projetos p ON p.id = ps.projeto_id
    WHERE t.status <> 'concluida'
      AND t.responsavel_id IS NOT NULL
      AND t.data_prazo IS NOT NULL
      AND (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date = v_today + INTERVAL '3 days'
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    SELECT a.responsavel_id, 'task_assigned',
           'Tarefa vence em 3 dias',
           'A tarefa "' || LEFT(a.titulo, 60) || '" vence em 3 dias no projeto ' || a.projeto_nome,
           '/projetos/' || a.projeto_id::text
    FROM alvo a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = a.responsavel_id
        AND n.type = 'task_assigned'
        AND n.title = 'Tarefa vence em 3 dias'
        AND n.message LIKE '%' || LEFT(a.titulo, 60) || '%'
        AND n.created_at::date = v_today
    )
    RETURNING 1
  ) SELECT count(*) INTO v_count_3 FROM ins;

  -- 1 dia para vencer
  WITH alvo AS (
    SELECT t.id, t.titulo, t.responsavel_id, t.data_prazo,
           p.id AS projeto_id, p.nome AS projeto_nome
    FROM public.projeto_tarefas t
    JOIN public.projeto_secoes ps ON ps.id = t.secao_id
    JOIN public.projetos p ON p.id = ps.projeto_id
    WHERE t.status <> 'concluida'
      AND t.responsavel_id IS NOT NULL
      AND t.data_prazo IS NOT NULL
      AND (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date = v_today + INTERVAL '1 day'
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    SELECT a.responsavel_id, 'task_assigned',
           'Tarefa vence amanhã',
           'A tarefa "' || LEFT(a.titulo, 60) || '" vence amanhã no projeto ' || a.projeto_nome,
           '/projetos/' || a.projeto_id::text
    FROM alvo a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = a.responsavel_id
        AND n.type = 'task_assigned'
        AND n.title = 'Tarefa vence amanhã'
        AND n.message LIKE '%' || LEFT(a.titulo, 60) || '%'
        AND n.created_at::date = v_today
    )
    RETURNING 1
  ) SELECT count(*) INTO v_count_1 FROM ins;

  -- Vencidas (apenas no primeiro dia de atraso para não spammar)
  WITH alvo AS (
    SELECT t.id, t.titulo, t.responsavel_id, t.data_prazo,
           p.id AS projeto_id, p.nome AS projeto_nome
    FROM public.projeto_tarefas t
    JOIN public.projeto_secoes ps ON ps.id = t.secao_id
    JOIN public.projetos p ON p.id = ps.projeto_id
    WHERE t.status <> 'concluida'
      AND t.responsavel_id IS NOT NULL
      AND t.data_prazo IS NOT NULL
      AND (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date < v_today
  ), ins AS (
    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    SELECT a.responsavel_id, 'task_assigned',
           'Tarefa em atraso',
           'A tarefa "' || LEFT(a.titulo, 60) || '" está em atraso no projeto ' || a.projeto_nome,
           '/projetos/' || a.projeto_id::text
    FROM alvo a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = a.responsavel_id
        AND n.type = 'task_assigned'
        AND n.title = 'Tarefa em atraso'
        AND n.message LIKE '%' || LEFT(a.titulo, 60) || '%'
        AND n.created_at::date = v_today
    )
    RETURNING 1
  ) SELECT count(*) INTO v_count_v FROM ins;

  RETURN QUERY VALUES ('vence_3d', v_count_3), ('vence_1d', v_count_1), ('vencida', v_count_v);
END;
$function$;

-- 4) Cron diário às 11:00 UTC (08:00 America/Sao_Paulo)
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'projetos-notify-deadlines';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'projetos-notify-deadlines',
    '0 11 * * *',
    $cron$ SELECT public.notify_task_deadlines(); $cron$
  );
END $$;