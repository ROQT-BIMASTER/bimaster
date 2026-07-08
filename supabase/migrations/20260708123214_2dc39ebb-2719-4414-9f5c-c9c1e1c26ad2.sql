
CREATE OR REPLACE FUNCTION public.notify_sla_ticket_gerencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_msg text;
  v_url text;
  v_prio text;
  v_papel_prio text[] := ARRAY['lider','gerente','diretor','coordenador'];
  v_targets uuid[];
BEGIN
  IF NEW.categoria IS DISTINCT FROM 'sla_projeto' THEN
    RETURN NEW;
  END IF;

  v_prio := UPPER(COALESCE(NEW.prioridade, 'media'));
  v_titulo := 'Novo protocolo de SLA (' || v_prio || ') — ' || COALESCE(NEW.protocolo, '');
  v_msg := 'O sistema abriu automaticamente o protocolo ' || COALESCE(NEW.protocolo, '') ||
           ' porque uma tarefa entrou em ' ||
           CASE WHEN NEW.sla_status = 'violado' THEN 'violação de SLA' ELSE 'risco de SLA' END ||
           '. Assunto: ' || COALESCE(NEW.titulo, '(sem título)');
  v_url := '/dashboard/suporte/chamados?ticket=' || NEW.id::text;

  -- Alvos: gerência/liderança da fila
  SELECT COALESCE(array_agg(DISTINCT sfa.user_id), ARRAY[]::uuid[])
    INTO v_targets
    FROM public.suporte_fila_agentes sfa
   WHERE sfa.fila_id = NEW.fila_id
     AND sfa.ativo = true
     AND sfa.papel = ANY(v_papel_prio);

  -- Fallback: se não houver gerência, notifica todos os agentes ativos da fila
  IF v_targets IS NULL OR array_length(v_targets, 1) IS NULL THEN
    SELECT COALESCE(array_agg(DISTINCT sfa.user_id), ARRAY[]::uuid[])
      INTO v_targets
      FROM public.suporte_fila_agentes sfa
     WHERE sfa.fila_id = NEW.fila_id
       AND sfa.ativo = true;
  END IF;

  -- Inclui o assignee direto quando definido
  IF NEW.assignee_id IS NOT NULL THEN
    v_targets := array_append(COALESCE(v_targets, ARRAY[]::uuid[]), NEW.assignee_id);
  END IF;

  IF v_targets IS NULL OR array_length(v_targets, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Escreve na inbox unificada (tabela notifications)
  INSERT INTO public.notifications (user_id, type, title, message, action_url)
  SELECT DISTINCT t, 'sla_projeto', v_titulo, v_msg, v_url
    FROM unnest(v_targets) AS t
   WHERE t IS NOT NULL;

  -- Escreve também no sino legado (notificacoes) para retrocompatibilidade
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, referencia_id, referencia_tipo)
  SELECT DISTINCT t, v_titulo, v_msg, 'sla_projeto', NEW.id::text, 'suporte_ticket'
    FROM unnest(v_targets) AS t
   WHERE t IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_sla_ticket_gerencia ON public.suporte_tickets;
CREATE TRIGGER trg_notify_sla_ticket_gerencia
AFTER INSERT ON public.suporte_tickets
FOR EACH ROW
WHEN (NEW.categoria = 'sla_projeto')
EXECUTE FUNCTION public.notify_sla_ticket_gerencia();
