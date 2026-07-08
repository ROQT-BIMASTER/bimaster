
ALTER TABLE public.processo_etapas
  ADD COLUMN IF NOT EXISTS escalonamento_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fila_escalonamento_id uuid REFERENCES public.suporte_filas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prioridade_escalonamento text,
  ADD COLUMN IF NOT EXISTS risco_percent integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS escalonamento_assignee_id uuid;

ALTER TABLE public.processo_etapas
  DROP CONSTRAINT IF EXISTS processo_etapas_prioridade_escalonamento_chk;
ALTER TABLE public.processo_etapas
  ADD CONSTRAINT processo_etapas_prioridade_escalonamento_chk
  CHECK (prioridade_escalonamento IS NULL OR prioridade_escalonamento IN ('baixa','media','alta','critica'));

ALTER TABLE public.processo_etapas
  DROP CONSTRAINT IF EXISTS processo_etapas_risco_percent_chk;
ALTER TABLE public.processo_etapas
  ADD CONSTRAINT processo_etapas_risco_percent_chk
  CHECK (risco_percent BETWEEN 1 AND 100);

CREATE OR REPLACE FUNCTION public.abrir_ticket_sla_tarefa(_tarefa_id uuid, _sla_status text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tarefa record;
  v_espelho record;
  v_etapa record;
  v_processo record;
  v_ticket_id uuid;
  v_prioridade text;
  v_atraso_min numeric;
  v_prazo_min numeric;
  v_percent numeric;
  v_resumo text;
  v_protocolo text;
  v_fila_id uuid;
  v_assignee uuid;
BEGIN
  IF _sla_status NOT IN ('em_risco','violado') THEN
    RETURN NULL;
  END IF;

  SELECT id, projeto_id, titulo, descricao, status, data_prazo, data_conclusao,
         sla_ticket_id, sla_protocolo, created_at
    INTO v_tarefa
    FROM public.projeto_tarefas
   WHERE id = _tarefa_id;

  IF v_tarefa.id IS NULL THEN RETURN NULL; END IF;
  IF v_tarefa.data_conclusao IS NOT NULL THEN RETURN NULL; END IF;
  IF v_tarefa.status IN ('concluida','cancelada','arquivada') THEN RETURN NULL; END IF;

  -- Prioridade padrão pela janela de atraso
  IF _sla_status = 'em_risco' THEN
    v_prioridade := 'media';
  ELSE
    v_atraso_min := GREATEST(EXTRACT(EPOCH FROM (now() - v_tarefa.data_prazo)) / 60.0, 0);
    v_prazo_min  := GREATEST(EXTRACT(EPOCH FROM (v_tarefa.data_prazo - v_tarefa.created_at)) / 60.0, 1);
    v_percent    := (v_atraso_min / v_prazo_min) * 100.0;
    v_prioridade := CASE
      WHEN v_percent > 200 THEN 'critica'
      WHEN v_percent > 100 THEN 'alta'
      WHEN v_percent >  50 THEN 'media'
      ELSE 'baixa'
    END;
  END IF;

  -- Etapa vinculada via espelho
  SELECT e.etapa_id, pe.processo_id, pe.nome_override AS etapa_nome, pe.sla_minutos,
         pe.escalonamento_ativo, pe.fila_escalonamento_id, pe.prioridade_escalonamento,
         pe.escalonamento_assignee_id
    INTO v_espelho
    FROM public.processo_tarefa_espelho e
    LEFT JOIN public.processo_etapas pe ON pe.id = e.etapa_id
   WHERE e.projeto_tarefa_id = _tarefa_id
   ORDER BY e.created_at DESC
   LIMIT 1;

  -- Se etapa configurada e escalonamento desativado, não abre ticket
  IF v_espelho.etapa_id IS NOT NULL AND v_espelho.escalonamento_ativo = false THEN
    RETURN NULL;
  END IF;

  IF v_espelho.processo_id IS NOT NULL THEN
    SELECT nome, descricao, fila_dona_id
      INTO v_processo
      FROM public.processos_operacionais
     WHERE id = v_espelho.processo_id;
  END IF;

  -- Precedência: etapa > processo
  v_fila_id  := COALESCE(v_espelho.fila_escalonamento_id, v_processo.fila_dona_id);
  v_assignee := v_espelho.escalonamento_assignee_id;
  IF v_espelho.prioridade_escalonamento IS NOT NULL THEN
    v_prioridade := v_espelho.prioridade_escalonamento;
  END IF;

  v_resumo := COALESCE(
    'SLA de projeto violado/em risco. ' ||
    CASE WHEN v_processo.nome IS NOT NULL
      THEN 'Processo vinculado: ' || v_processo.nome ||
           COALESCE(' — Etapa: ' || v_espelho.etapa_nome, '') || E'\n\n' ||
           COALESCE(v_processo.descricao, '')
      ELSE 'Tarefa sem processo operacional vinculado.'
    END,
    'SLA de projeto violado/em risco.'
  );

  IF v_tarefa.sla_ticket_id IS NOT NULL THEN
    UPDATE public.suporte_tickets
       SET sla_status = _sla_status,
           prioridade = v_prioridade,
           assignee_id = COALESCE(assignee_id, v_assignee),
           fila_id = COALESCE(v_fila_id, fila_id),
           updated_at = now()
     WHERE id = v_tarefa.sla_ticket_id;

    UPDATE public.projeto_tarefas
       SET sla_status = _sla_status
     WHERE id = _tarefa_id;

    RETURN v_tarefa.sla_ticket_id;
  END IF;

  v_protocolo := public.suporte_gerar_protocolo('SLA');

  INSERT INTO public.suporte_tickets
    (titulo, resumo, categoria, prioridade, sla_status, status,
     projeto_tarefa_id, fila_id, assignee_id, protocolo, tags, escalado_em)
  VALUES
    (LEFT(COALESCE(v_tarefa.titulo, 'Tarefa sem título'), 200),
     v_resumo,
     'sla_projeto',
     v_prioridade,
     _sla_status,
     'novo',
     _tarefa_id,
     v_fila_id,
     v_assignee,
     v_protocolo,
     ARRAY['sla-projeto', COALESCE(v_processo.nome, 'sem-processo')]::text[],
     now())
  RETURNING id INTO v_ticket_id;

  UPDATE public.projeto_tarefas
     SET sla_ticket_id = v_ticket_id,
         sla_protocolo = v_protocolo,
         sla_status    = _sla_status
   WHERE id = _tarefa_id;

  RETURN v_ticket_id;
END;
$function$;
