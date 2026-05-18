-- =========================================================================
-- notify_task_deadlines_chat — agregação de prazos no Chat IA do projeto
-- =========================================================================
--
-- Complemento da `notify_task_deadlines()` existente (mai/2026-04-27) que
-- insere notificações individuais em `public.notifications`. Esta função
-- agrega TODAS as tarefas em alerta de um projeto em UMA mensagem do tipo
-- 'sistema' no Chat IA daquele projeto (`projeto_chat_messages`).
--
-- Resultado: o time vê o resumo de prazos direto na aba "Chat IA" do
-- projeto, sem precisar caçar sino do header por sino. Diferencial único
-- do bimaster — o sistema conhece os projetos e fala com você dentro deles.
--
-- Idempotência: usa `metadata->>'tipo' = 'prazos_alerta'` + filtro de
-- `created_at::date = hoje` pra não duplicar a mensagem se a função
-- rodar 2x no mesmo dia.

CREATE OR REPLACE FUNCTION public.notify_task_deadlines_chat()
RETURNS TABLE(projeto_id uuid, postado boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_proj  RECORD;
  v_conteudo TEXT;
  v_ja_existe BOOLEAN;
  v_tem_conteudo BOOLEAN;
BEGIN
  -- Itera projetos ativos com pelo menos 1 tarefa em alerta hoje
  FOR v_proj IN
    SELECT DISTINCT p.id, p.nome
    FROM public.projetos p
    JOIN public.projeto_secoes ps ON ps.projeto_id = p.id
    JOIN public.projeto_tarefas t ON t.secao_id = ps.id
    WHERE t.status <> 'concluida'
      AND t.excluida_em IS NULL
      AND t.data_prazo IS NOT NULL
      AND (
        (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date = v_today + INTERVAL '3 days'
        OR (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date = v_today + INTERVAL '1 day'
        OR (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date < v_today
      )
  LOOP
    -- Idempotência: já postou hoje?
    SELECT EXISTS (
      SELECT 1 FROM public.projeto_chat_messages
      WHERE projeto_id = v_proj.id
        AND tipo = 'sistema'
        AND created_at::date = v_today
        AND metadata->>'tipo' = 'prazos_alerta'
    ) INTO v_ja_existe;

    IF v_ja_existe THEN
      RETURN QUERY SELECT v_proj.id, false;
      CONTINUE;
    END IF;

    -- Constrói o markdown da mensagem agrupando por bucket
    v_conteudo := '**📅 Resumo de prazos — ' || to_char(v_today, 'DD/MM/YYYY') || '**' || E'\n\n';
    v_tem_conteudo := false;

    -- Vencidas
    DECLARE v_temp text := '';
    BEGIN
      SELECT string_agg(
        '- *' || LEFT(t.titulo, 80) || '*' ||
        CASE WHEN pr.nome IS NOT NULL THEN ' — ' || pr.nome ELSE '' END,
        E'\n'
      ) INTO v_temp
      FROM public.projeto_tarefas t
      JOIN public.projeto_secoes ps ON ps.id = t.secao_id
      LEFT JOIN public.profiles pr ON pr.id = t.responsavel_id
      WHERE ps.projeto_id = v_proj.id
        AND t.status <> 'concluida'
        AND t.excluida_em IS NULL
        AND t.data_prazo IS NOT NULL
        AND (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date < v_today;

      IF v_temp IS NOT NULL AND length(v_temp) > 0 THEN
        v_conteudo := v_conteudo || '⚠️ **Em atraso**' || E'\n' || v_temp || E'\n\n';
        v_tem_conteudo := true;
      END IF;
    END;

    -- Vence amanhã (1d)
    DECLARE v_temp text := '';
    BEGIN
      SELECT string_agg(
        '- *' || LEFT(t.titulo, 80) || '*' ||
        CASE WHEN pr.nome IS NOT NULL THEN ' — ' || pr.nome ELSE '' END,
        E'\n'
      ) INTO v_temp
      FROM public.projeto_tarefas t
      JOIN public.projeto_secoes ps ON ps.id = t.secao_id
      LEFT JOIN public.profiles pr ON pr.id = t.responsavel_id
      WHERE ps.projeto_id = v_proj.id
        AND t.status <> 'concluida'
        AND t.excluida_em IS NULL
        AND (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date = v_today + INTERVAL '1 day';

      IF v_temp IS NOT NULL AND length(v_temp) > 0 THEN
        v_conteudo := v_conteudo || '🟡 **Vence amanhã**' || E'\n' || v_temp || E'\n\n';
        v_tem_conteudo := true;
      END IF;
    END;

    -- Vence em 3 dias
    DECLARE v_temp text := '';
    BEGIN
      SELECT string_agg(
        '- *' || LEFT(t.titulo, 80) || '*' ||
        CASE WHEN pr.nome IS NOT NULL THEN ' — ' || pr.nome ELSE '' END,
        E'\n'
      ) INTO v_temp
      FROM public.projeto_tarefas t
      JOIN public.projeto_secoes ps ON ps.id = t.secao_id
      LEFT JOIN public.profiles pr ON pr.id = t.responsavel_id
      WHERE ps.projeto_id = v_proj.id
        AND t.status <> 'concluida'
        AND t.excluida_em IS NULL
        AND (t.data_prazo AT TIME ZONE 'America/Sao_Paulo')::date = v_today + INTERVAL '3 days';

      IF v_temp IS NOT NULL AND length(v_temp) > 0 THEN
        v_conteudo := v_conteudo || '🔵 **Vence em 3 dias**' || E'\n' || v_temp;
        v_tem_conteudo := true;
      END IF;
    END;

    IF NOT v_tem_conteudo THEN
      RETURN QUERY SELECT v_proj.id, false;
      CONTINUE;
    END IF;

    -- Insere a mensagem
    INSERT INTO public.projeto_chat_messages (
      projeto_id, user_id, conteudo, tipo, metadata
    ) VALUES (
      v_proj.id, NULL, v_conteudo, 'sistema',
      jsonb_build_object('tipo', 'prazos_alerta', 'data', v_today::text)
    );

    RETURN QUERY SELECT v_proj.id, true;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_task_deadlines_chat() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.notify_task_deadlines_chat() TO authenticated, service_role;

COMMENT ON FUNCTION public.notify_task_deadlines_chat IS
  'Agrega prazos de tarefas em uma mensagem do tipo sistema no Chat IA do
   projeto (projeto_chat_messages). Idempotente via metadata.tipo + data.
   Roda em paralelo com notify_task_deadlines() — uma alimenta sino do
   header, esta alimenta o canal do projeto.';

-- Registra cron — mesmo horário do notify_task_deadlines (11:00 UTC = 8h BRT)
DO $$
DECLARE
  v_jobid BIGINT;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'projetos-notify-deadlines-chat';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'projetos-notify-deadlines-chat',
    '5 11 * * *',  -- 5 min depois do principal pra dar tempo das notifications individuais primeiro
    $cron$ SELECT public.notify_task_deadlines_chat(); $cron$
  );
END $$;
