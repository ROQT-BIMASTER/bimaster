
CREATE OR REPLACE FUNCTION public.audit_sla_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_espelho record;
  v_processo record;
  v_tarefa record;
  v_payload jsonb;
BEGIN
  -- Só audita chamados abertos pelo escalador automático de SLA
  IF NEW.categoria IS DISTINCT FROM 'sla_projeto' THEN
    RETURN NEW;
  END IF;

  -- Localiza tarefa/processo/etapa quando o chamado vem vinculado a uma tarefa
  IF NEW.projeto_tarefa_id IS NOT NULL THEN
    SELECT id, titulo, projeto_id, data_prazo, created_at
      INTO v_tarefa
      FROM public.projeto_tarefas
     WHERE id = NEW.projeto_tarefa_id;

    SELECT e.etapa_id, pe.processo_id, pe.nome_override AS etapa_nome, pe.ordem AS etapa_ordem
      INTO v_espelho
      FROM public.processo_tarefa_espelho e
      LEFT JOIN public.processo_etapas pe ON pe.id = e.etapa_id
     WHERE e.projeto_tarefa_id = NEW.projeto_tarefa_id
     ORDER BY e.created_at DESC
     LIMIT 1;

    IF v_espelho.processo_id IS NOT NULL THEN
      SELECT id, nome, fila_dona_id
        INTO v_processo
        FROM public.processos_operacionais
       WHERE id = v_espelho.processo_id;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_payload := jsonb_build_object(
      'evento', 'sla_aberto',
      'ocorrido_em', now(),
      'sla_status', NEW.sla_status,
      'prioridade', NEW.prioridade,
      'protocolo', NEW.protocolo,
      'fila_id', NEW.fila_id,
      'assignee_id', NEW.assignee_id,
      'tarefa', CASE WHEN v_tarefa.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', v_tarefa.id,
        'titulo', v_tarefa.titulo,
        'projeto_id', v_tarefa.projeto_id,
        'data_prazo', v_tarefa.data_prazo,
        'created_at', v_tarefa.created_at
      ) END,
      'processo', CASE WHEN v_processo.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', v_processo.id,
        'nome', v_processo.nome
      ) END,
      'etapa', CASE WHEN v_espelho.etapa_id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', v_espelho.etapa_id,
        'nome', v_espelho.etapa_nome,
        'ordem', v_espelho.etapa_ordem
      ) END
    );

    INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload, resultado)
    VALUES (NEW.id, 'sla_aberto', v_payload,
            'Chamado aberto automaticamente (' || COALESCE(NEW.sla_status,'') || ')');
    RETURN NEW;
  END IF;

  -- UPDATE: registra transições de estado do SLA
  IF NEW.sla_status IS DISTINCT FROM OLD.sla_status THEN
    v_payload := jsonb_build_object(
      'evento', 'sla_transicao',
      'ocorrido_em', now(),
      'de', OLD.sla_status,
      'para', NEW.sla_status,
      'prioridade_anterior', OLD.prioridade,
      'prioridade_atual', NEW.prioridade,
      'protocolo', NEW.protocolo,
      'projeto_tarefa_id', NEW.projeto_tarefa_id
    );

    INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload, resultado)
    VALUES (
      NEW.id,
      CASE
        WHEN NEW.sla_status = 'violado'  THEN 'sla_violado'
        WHEN NEW.sla_status = 'em_risco' THEN 'sla_em_risco'
        WHEN NEW.sla_status = 'cumprido' THEN 'sla_cumprido'
        ELSE 'sla_status_change'
      END,
      v_payload,
      'SLA passou de ' || COALESCE(OLD.sla_status,'—') || ' para ' || COALESCE(NEW.sla_status,'—')
    );
  END IF;

  -- Encerramento do chamado (status resolvido/fechado)
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('resolvido','fechado')
     AND OLD.status NOT IN ('resolvido','fechado') THEN
    INSERT INTO public.suporte_tickets_audit (ticket_id, acao, payload, resultado)
    VALUES (
      NEW.id,
      'sla_encerrado',
      jsonb_build_object(
        'evento', 'sla_encerrado',
        'ocorrido_em', now(),
        'status', NEW.status,
        'sla_status_final', NEW.sla_status,
        'protocolo', NEW.protocolo,
        'projeto_tarefa_id', NEW.projeto_tarefa_id
      ),
      'Chamado encerrado (' || NEW.status || ')'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_sla_ticket_ins ON public.suporte_tickets;
CREATE TRIGGER trg_audit_sla_ticket_ins
AFTER INSERT ON public.suporte_tickets
FOR EACH ROW
WHEN (NEW.categoria = 'sla_projeto')
EXECUTE FUNCTION public.audit_sla_ticket();

DROP TRIGGER IF EXISTS trg_audit_sla_ticket_upd ON public.suporte_tickets;
CREATE TRIGGER trg_audit_sla_ticket_upd
AFTER UPDATE ON public.suporte_tickets
FOR EACH ROW
WHEN (NEW.categoria = 'sla_projeto')
EXECUTE FUNCTION public.audit_sla_ticket();
