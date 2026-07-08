-- =====================================================
-- SLA Camada 2 — escala tarefas de Meus Projetos para a Central de Suporte
-- Camada 1 (coordenador): SLA da rotina/etapa no processo operacional.
-- Camada 2 (gerência/diretoria): quando Camada 1 viola/entra em risco,
--   o sistema abre chamado com protocolo e prioridade automática.
-- =====================================================

ALTER TABLE public.projeto_tarefas
  ADD COLUMN IF NOT EXISTS sla_ticket_id uuid REFERENCES public.suporte_tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sla_protocolo text,
  ADD COLUMN IF NOT EXISTS sla_status text CHECK (sla_status IN ('em_risco','violado','cumprido'));

COMMENT ON COLUMN public.projeto_tarefas.sla_ticket_id IS
  'Chamado aberto automaticamente na Central de Suporte quando o SLA da tarefa é violado ou entra em risco (Camada 2 de SLA).';
COMMENT ON COLUMN public.projeto_tarefas.sla_protocolo IS
  'Número de protocolo do chamado de SLA vinculado. Formato: SLA-AAAAMMDD-XXXXXX.';
COMMENT ON COLUMN public.projeto_tarefas.sla_status IS
  'Status agregado do SLA: em_risco (próximo do prazo), violado (excedido), cumprido (concluída dentro do prazo).';

-- Índice parcial p/ o escalador percorrer só o que interessa
CREATE INDEX IF NOT EXISTS idx_projeto_tarefas_sla_scan
  ON public.projeto_tarefas (data_prazo)
  WHERE data_conclusao IS NULL AND data_prazo IS NOT NULL;

-- =====================================================
-- Gerador de protocolo (SLA-YYYYMMDD-XXXXXX)
-- =====================================================
CREATE OR REPLACE FUNCTION public.suporte_gerar_protocolo(prefix text DEFAULT 'SLA')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suffix text;
BEGIN
  v_suffix := upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));
  RETURN prefix || '-' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD') || '-' || v_suffix;
END;
$$;

-- =====================================================
-- Abrir/atualizar ticket de SLA (idempotente)
-- =====================================================
CREATE OR REPLACE FUNCTION public.abrir_ticket_sla_tarefa(_tarefa_id uuid, _sla_status text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tarefa record;
  v_espelho record;
  v_processo record;
  v_ticket_id uuid;
  v_prioridade text;
  v_atraso_min numeric;
  v_prazo_min numeric;
  v_percent numeric;
  v_resumo text;
  v_protocolo text;
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

  -- Calcula prioridade a partir do atraso vs prazo original
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

  -- Busca processo/etapa vinculado (via espelho de processo)
  SELECT e.etapa_id, pe.processo_id, pe.nome_override AS etapa_nome, pe.sla_minutos
    INTO v_espelho
    FROM public.processo_tarefa_espelho e
    LEFT JOIN public.processo_etapas pe ON pe.id = e.etapa_id
   WHERE e.projeto_tarefa_id = _tarefa_id
   ORDER BY e.created_at DESC
   LIMIT 1;

  IF v_espelho.processo_id IS NOT NULL THEN
    SELECT nome, descricao, fila_dona_id
      INTO v_processo
      FROM public.processos_operacionais
     WHERE id = v_espelho.processo_id;
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

  -- Já existe ticket? Só atualiza.
  IF v_tarefa.sla_ticket_id IS NOT NULL THEN
    UPDATE public.suporte_tickets
       SET sla_status = _sla_status,
           prioridade = v_prioridade,
           updated_at = now()
     WHERE id = v_tarefa.sla_ticket_id;

    UPDATE public.projeto_tarefas
       SET sla_status = _sla_status
     WHERE id = _tarefa_id;

    RETURN v_tarefa.sla_ticket_id;
  END IF;

  -- Cria ticket novo
  v_protocolo := public.suporte_gerar_protocolo('SLA');

  INSERT INTO public.suporte_tickets
    (titulo, resumo, categoria, prioridade, sla_status, status,
     projeto_tarefa_id, fila_id, protocolo, tags, escalado_em)
  VALUES
    (LEFT(COALESCE(v_tarefa.titulo, 'Tarefa sem título'), 200),
     v_resumo,
     'sla_projeto',
     v_prioridade,
     _sla_status,
     'novo',
     _tarefa_id,
     v_processo.fila_dona_id,
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
$$;

-- =====================================================
-- Trigger: reflete conclusão da tarefa no ticket
-- =====================================================
CREATE OR REPLACE FUNCTION public.tg_sla_projeto_conclui_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_final_status text;
BEGIN
  IF NEW.data_conclusao IS NULL AND OLD.data_conclusao IS NOT NULL THEN
    -- reaberta: sai daqui
    RETURN NEW;
  END IF;
  IF NEW.data_conclusao IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.data_conclusao IS NOT NULL THEN
    RETURN NEW; -- já processado
  END IF;

  -- concluída agora
  IF NEW.data_prazo IS NULL OR NEW.data_conclusao <= NEW.data_prazo THEN
    v_final_status := 'cumprido';
  ELSE
    v_final_status := 'violado';
  END IF;

  IF NEW.sla_ticket_id IS NOT NULL THEN
    UPDATE public.suporte_tickets
       SET sla_status = v_final_status,
           status = CASE WHEN v_final_status = 'cumprido' THEN 'resolvido' ELSE status END,
           resolved_at = CASE WHEN v_final_status = 'cumprido' THEN now() ELSE resolved_at END,
           updated_at = now()
     WHERE id = NEW.sla_ticket_id;
  END IF;

  NEW.sla_status := v_final_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sla_projeto_conclui_ticket ON public.projeto_tarefas;
CREATE TRIGGER trg_sla_projeto_conclui_ticket
  BEFORE UPDATE OF data_conclusao ON public.projeto_tarefas
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_sla_projeto_conclui_ticket();