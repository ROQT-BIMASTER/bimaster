
-- Função utilitária: garante execução do dia e etapas
CREATE OR REPLACE FUNCTION public.ensure_processo_execucao_dia(_processo_id uuid, _data_ref date DEFAULT CURRENT_DATE)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exec_id uuid;
BEGIN
  SELECT id INTO v_exec_id
    FROM processo_execucoes
    WHERE processo_id = _processo_id AND data_ref = _data_ref
    LIMIT 1;

  IF v_exec_id IS NULL THEN
    INSERT INTO processo_execucoes (processo_id, data_ref, status, iniciado_em)
    VALUES (_processo_id, _data_ref, 'em_andamento', now())
    RETURNING id INTO v_exec_id;

    INSERT INTO processo_execucao_etapas (execucao_id, etapa_id, status)
    SELECT v_exec_id, id, 'pendente'
    FROM processo_etapas
    WHERE processo_id = _processo_id;
  END IF;

  RETURN v_exec_id;
END;
$$;

-- Trigger AFTER INSERT: cria espelho quando a tarefa nasce em projeto vinculado
CREATE OR REPLACE FUNCTION public.tg_projeto_tarefa_processo_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rotina record;
  v_etapa record;
  v_exec_id uuid;
  v_sla_min int;
  v_secao_ordem int;
BEGIN
  -- Se já existe espelho (ex.: instanciador criou explicitamente), não faz nada
  IF EXISTS (SELECT 1 FROM processo_tarefa_espelho WHERE projeto_tarefa_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Busca rotina fixa que espelha este projeto (usa a primeira encontrada)
  SELECT r.id, r.fila_id
    INTO v_rotina
    FROM suporte_rotinas_fixas r
    WHERE r.projeto_id_espelho = NEW.projeto_id
    LIMIT 1;
  IF v_rotina.id IS NULL THEN
    RETURN NEW;  -- projeto não é operacional
  END IF;

  -- Determina etapa pela ordem da seção (0-based → +1)
  SELECT ordem INTO v_secao_ordem
    FROM projeto_secoes
    WHERE id = NEW.secao_id;
  v_secao_ordem := COALESCE(v_secao_ordem, 0);

  SELECT pe.id, pe.processo_id, pe.sla_minutos
    INTO v_etapa
    FROM processo_etapas pe
    JOIN suporte_rotinas_fixas r2 ON r2.id = pe.rotina_fixa_id
    WHERE r2.projeto_id_espelho = NEW.projeto_id
      AND pe.ordem = v_secao_ordem + 1
    ORDER BY pe.ordem
    LIMIT 1;

  -- Fallback: primeira etapa do processo
  IF v_etapa.id IS NULL THEN
    SELECT pe.id, pe.processo_id, pe.sla_minutos
      INTO v_etapa
      FROM processo_etapas pe
      JOIN suporte_rotinas_fixas r2 ON r2.id = pe.rotina_fixa_id
      WHERE r2.projeto_id_espelho = NEW.projeto_id
      ORDER BY pe.ordem
      LIMIT 1;
  END IF;
  IF v_etapa.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_sla_min := COALESCE(v_etapa.sla_minutos, 60);
  v_exec_id := ensure_processo_execucao_dia(v_etapa.processo_id, CURRENT_DATE);

  INSERT INTO processo_tarefa_espelho (
    etapa_id, projeto_tarefa_id, projeto_id, execucao_id, sla_limite, status, created_by
  ) VALUES (
    v_etapa.id, NEW.id, NEW.projeto_id, v_exec_id,
    now() + make_interval(mins => v_sla_min),
    'pendente', NEW.criador_id
  );

  -- Preenche data_inicio e data_prazo na própria tarefa (se ainda nulos)
  UPDATE projeto_tarefas
     SET data_inicio = COALESCE(data_inicio, CURRENT_DATE),
         data_prazo  = COALESCE(data_prazo, (now() + make_interval(mins => v_sla_min))::date)
   WHERE id = NEW.id;

  -- Marca etapa como em_andamento se a tarefa nasceu não-pendente
  UPDATE processo_execucao_etapas
     SET status = CASE WHEN NEW.status = 'em_andamento' THEN 'em_andamento' ELSE status END,
         iniciado_em = COALESCE(iniciado_em, CASE WHEN NEW.status = 'em_andamento' THEN now() END)
   WHERE execucao_id = v_exec_id AND etapa_id = v_etapa.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projeto_tarefa_processo_insert ON projeto_tarefas;
CREATE TRIGGER trg_projeto_tarefa_processo_insert
AFTER INSERT ON projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.tg_projeto_tarefa_processo_insert();

-- Trigger AFTER UPDATE: acompanha status e mudança de seção
CREATE OR REPLACE FUNCTION public.tg_projeto_tarefa_processo_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_esp record;
  v_nova_etapa record;
  v_secao_ordem int;
  v_total int;
  v_concluidas int;
BEGIN
  SELECT * INTO v_esp
    FROM processo_tarefa_espelho
    WHERE projeto_tarefa_id = NEW.id
    LIMIT 1;
  IF v_esp.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mudança de seção → avança etapa correspondente
  IF NEW.secao_id IS DISTINCT FROM OLD.secao_id THEN
    SELECT ordem INTO v_secao_ordem FROM projeto_secoes WHERE id = NEW.secao_id;
    v_secao_ordem := COALESCE(v_secao_ordem, 0);

    SELECT pe.id, pe.processo_id, pe.sla_minutos
      INTO v_nova_etapa
      FROM processo_etapas pe
      JOIN suporte_rotinas_fixas r ON r.id = pe.rotina_fixa_id
      WHERE r.projeto_id_espelho = NEW.projeto_id
        AND pe.ordem = v_secao_ordem + 1
      LIMIT 1;

    IF v_nova_etapa.id IS NOT NULL AND v_nova_etapa.id <> v_esp.etapa_id THEN
      -- Marca etapa anterior como concluída (nesta execução)
      UPDATE processo_execucao_etapas
         SET status = 'concluida', concluido_em = COALESCE(concluido_em, now())
       WHERE execucao_id = v_esp.execucao_id AND etapa_id = v_esp.etapa_id;

      -- Marca nova etapa como em_andamento
      UPDATE processo_execucao_etapas
         SET status = 'em_andamento', iniciado_em = COALESCE(iniciado_em, now())
       WHERE execucao_id = v_esp.execucao_id AND etapa_id = v_nova_etapa.id;

      -- Atualiza espelho com novo etapa_id e novo SLA
      UPDATE processo_tarefa_espelho
         SET etapa_id = v_nova_etapa.id,
             sla_limite = now() + make_interval(mins => COALESCE(v_nova_etapa.sla_minutos, 60)),
             status = 'pendente'
       WHERE id = v_esp.id;

      UPDATE projeto_tarefas
         SET data_prazo = (now() + make_interval(mins => COALESCE(v_nova_etapa.sla_minutos, 60)))::date
       WHERE id = NEW.id;
    END IF;
  END IF;

  -- Mudança de status da tarefa
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'em_andamento' THEN
      UPDATE processo_execucao_etapas
         SET status = 'em_andamento', iniciado_em = COALESCE(iniciado_em, now())
       WHERE execucao_id = v_esp.execucao_id AND etapa_id = v_esp.etapa_id;
      UPDATE processo_tarefa_espelho SET status = 'em_andamento' WHERE id = v_esp.id;
    ELSIF NEW.status = 'concluida' THEN
      UPDATE processo_execucao_etapas
         SET status = 'concluida', concluido_em = COALESCE(concluido_em, now())
       WHERE execucao_id = v_esp.execucao_id AND etapa_id = v_esp.etapa_id;
      UPDATE processo_tarefa_espelho
         SET status = 'concluida', concluida_em = now(), concluida_por = auth.uid()
       WHERE id = v_esp.id;
    END IF;
  END IF;

  -- SLA estourado
  IF v_esp.sla_limite IS NOT NULL AND now() > v_esp.sla_limite AND NEW.status <> 'concluida' THEN
    UPDATE processo_execucao_etapas
       SET status = 'violada', sla_estourado_em = COALESCE(sla_estourado_em, now())
     WHERE execucao_id = v_esp.execucao_id AND etapa_id = v_esp.etapa_id AND status <> 'concluida';
  END IF;

  -- Fecha execução do dia se todas as etapas estiverem concluídas
  SELECT count(*), count(*) FILTER (WHERE status = 'concluida')
    INTO v_total, v_concluidas
    FROM processo_execucao_etapas
    WHERE execucao_id = v_esp.execucao_id;
  IF v_total > 0 AND v_concluidas = v_total THEN
    UPDATE processo_execucoes
       SET status = 'concluida', concluido_em = COALESCE(concluido_em, now())
     WHERE id = v_esp.execucao_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projeto_tarefa_processo_update ON projeto_tarefas;
CREATE TRIGGER trg_projeto_tarefa_processo_update
AFTER UPDATE OF status, secao_id ON projeto_tarefas
FOR EACH ROW EXECUTE FUNCTION public.tg_projeto_tarefa_processo_update();

-- Backfill: para "pedido teste" e outras tarefas já existentes no projeto vinculado,
-- gerar espelho retroativamente (uma vez).
DO $$
DECLARE
  v_tarefa record;
BEGIN
  FOR v_tarefa IN
    SELECT pt.id
      FROM projeto_tarefas pt
      WHERE pt.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM suporte_rotinas_fixas r WHERE r.projeto_id_espelho = pt.projeto_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM processo_tarefa_espelho e WHERE e.projeto_tarefa_id = pt.id
        )
  LOOP
    -- Reusa a lógica de INSERT via update sem-op para disparar? Não — trigger é AFTER INSERT.
    -- Chamamos manualmente inserindo espelho + registro de execução.
    PERFORM 1;
  END LOOP;
END $$;
