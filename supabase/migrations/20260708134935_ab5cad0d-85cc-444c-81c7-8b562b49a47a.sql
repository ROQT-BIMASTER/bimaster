-- 1) Reescreve rpc_processo_execucao_dia para ler primariamente do espelho/execução
CREATE OR REPLACE FUNCTION public.rpc_processo_execucao_dia(
  _processo_id uuid,
  _data_ref date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date
)
RETURNS TABLE(
  etapa_id uuid, rotina_fixa_id uuid, rotina_titulo text,
  fila_id uuid, fila_nome text, fila_cor text,
  responsavel_user_id uuid, ordem integer, sla_minutos integer,
  execucao_id uuid, ticket_id uuid, status text,
  sla_deadline timestamp with time zone, concluida_em timestamp with time zone,
  sla_estourado boolean, minutos_para_deadline integer,
  handoff_pendente_de_etapa_id uuid, handoff_sla_minutos integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  WITH etapas AS (
    SELECT pe.id AS etapa_id, pe.processo_id, pe.rotina_fixa_id, pe.ordem, pe.sla_minutos,
           rf.titulo AS rotina_titulo, rf.fila_id, rf.responsavel_user_id,
           sf.nome AS fila_nome, sf.cor AS fila_cor
    FROM public.processo_etapas pe
    JOIN public.suporte_rotinas_fixas rf ON rf.id = pe.rotina_fixa_id
    LEFT JOIN public.suporte_filas sf ON sf.id = rf.fila_id
    WHERE pe.processo_id = _processo_id
  ),
  -- Fonte primária: execução do processo do dia (Kanban dos projetos alimenta essas tabelas)
  exec_dia AS (
    SELECT id AS execucao_id
    FROM public.processo_execucoes
    WHERE processo_id = _processo_id
      AND data_ref = _data_ref
    ORDER BY iniciado_em DESC NULLS LAST, created_at DESC
    LIMIT 1
  ),
  espelho AS (
    SELECT pte.etapa_id,
           pte.sla_limite,
           pte.concluida_em,
           pte.projeto_tarefa_id,
           pte.status AS espelho_status
    FROM public.processo_tarefa_espelho pte
    WHERE pte.execucao_id = (SELECT execucao_id FROM exec_dia)
  ),
  exec_etapas AS (
    SELECT pee.etapa_id, pee.status::text AS status, pee.iniciado_em, pee.concluido_em, pee.sla_estourado_em
    FROM public.processo_execucao_etapas pee
    WHERE pee.execucao_id = (SELECT execucao_id FROM exec_dia)
  ),
  -- Fallback: rotinas fixas do dia (modelo legado)
  rot_dia AS (
    SELECT sre.rotina_id, sre.id AS execucao_id, sre.ticket_id,
           sre.status::text AS status, sre.sla_deadline, sre.concluida_em
    FROM public.suporte_rotina_execucoes sre
    WHERE sre.data_referencia = _data_ref
      AND sre.rotina_id IN (SELECT rotina_fixa_id FROM etapas)
  ),
  handoffs AS (
    SELECT pl.para_etapa_id AS etapa_id,
           pl.de_etapa_id AS handoff_pendente_de_etapa_id,
           pl.sla_handoff_minutos AS handoff_sla_minutos
    FROM public.processo_ligacoes pl
    JOIN etapas e_origem ON e_origem.etapa_id = pl.de_etapa_id
    LEFT JOIN espelho esp_ori ON esp_ori.etapa_id = e_origem.etapa_id
    LEFT JOIN rot_dia rot_ori ON rot_ori.rotina_id = e_origem.rotina_fixa_id
    WHERE pl.processo_id = _processo_id
      AND esp_ori.concluida_em IS NULL
      AND rot_ori.concluida_em IS NULL
  ),
  handoff_min AS (
    SELECT etapa_id,
           (ARRAY_AGG(handoff_pendente_de_etapa_id ORDER BY handoff_sla_minutos NULLS LAST))[1] AS handoff_pendente_de_etapa_id,
           MIN(handoff_sla_minutos) AS handoff_sla_minutos
    FROM handoffs
    GROUP BY etapa_id
  )
  SELECT
    e.etapa_id, e.rotina_fixa_id, e.rotina_titulo, e.fila_id, e.fila_nome, e.fila_cor,
    e.responsavel_user_id, e.ordem, e.sla_minutos,
    COALESCE((SELECT execucao_id FROM exec_dia), rd.execucao_id) AS execucao_id,
    rd.ticket_id,
    CASE
      WHEN esp.concluida_em IS NOT NULL OR ee.status = 'concluida' THEN 'concluida'
      WHEN ee.status = 'atrasada' THEN 'violada'
      WHEN ee.status = 'em_execucao' THEN 'em_andamento'
      WHEN ee.status = 'pendente' THEN 'gerada'
      WHEN esp.espelho_status = 'em_andamento' THEN 'em_andamento'
      WHEN esp.espelho_status = 'pendente' THEN 'gerada'
      WHEN rd.status IS NOT NULL THEN rd.status
      ELSE 'nao_gerada'
    END AS status,
    COALESCE(esp.sla_limite, rd.sla_deadline) AS sla_deadline,
    COALESCE(esp.concluida_em, ee.concluido_em, rd.concluida_em) AS concluida_em,
    CASE
      WHEN COALESCE(esp.concluida_em, ee.concluido_em, rd.concluida_em) IS NOT NULL THEN false
      WHEN ee.sla_estourado_em IS NOT NULL THEN true
      WHEN COALESCE(esp.sla_limite, rd.sla_deadline) IS NOT NULL
           AND COALESCE(esp.sla_limite, rd.sla_deadline) < now() THEN true
      ELSE false
    END AS sla_estourado,
    CASE
      WHEN COALESCE(esp.sla_limite, rd.sla_deadline) IS NULL THEN NULL
      WHEN COALESCE(esp.concluida_em, ee.concluido_em, rd.concluida_em) IS NOT NULL THEN NULL
      ELSE (EXTRACT(EPOCH FROM (COALESCE(esp.sla_limite, rd.sla_deadline) - now()))::integer / 60)
    END AS minutos_para_deadline,
    hm.handoff_pendente_de_etapa_id,
    hm.handoff_sla_minutos
  FROM etapas e
  LEFT JOIN espelho esp ON esp.etapa_id = e.etapa_id
  LEFT JOIN exec_etapas ee ON ee.etapa_id = e.etapa_id
  LEFT JOIN rot_dia rd ON rd.rotina_id = e.rotina_fixa_id
  LEFT JOIN handoff_min hm ON hm.etapa_id = e.etapa_id
  ORDER BY e.ordem, e.rotina_titulo;
$function$;

-- 2) Validador de processo (usado pelo wizard "Publicar")
CREATE OR REPLACE FUNCTION public.rpc_validar_processo(_processo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_erros text[] := ARRAY[]::text[];
  v_avisos text[] := ARRAY[]::text[];
  v_qtd_etapas int;
  v_sem_fila int;
  v_sem_sla int;
  v_orfas int;
  v_secoes_inconsistentes int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.processos_operacionais WHERE id = _processo_id) THEN
    RETURN jsonb_build_object('ok', false, 'erros', ARRAY['Processo não encontrado'], 'avisos', ARRAY[]::text[]);
  END IF;

  SELECT count(*) INTO v_qtd_etapas FROM public.processo_etapas WHERE processo_id = _processo_id;
  IF v_qtd_etapas = 0 THEN
    v_erros := v_erros || 'O processo precisa ter pelo menos uma etapa.';
  END IF;

  SELECT count(*) INTO v_sem_fila
    FROM public.processo_etapas pe
    JOIN public.suporte_rotinas_fixas rf ON rf.id = pe.rotina_fixa_id
   WHERE pe.processo_id = _processo_id AND rf.fila_id IS NULL;
  IF v_sem_fila > 0 THEN
    v_erros := v_erros || format('%s etapa(s) sem fila/departamento definido.', v_sem_fila);
  END IF;

  SELECT count(*) INTO v_sem_sla
    FROM public.processo_etapas
   WHERE processo_id = _processo_id AND sla_minutos IS NULL;
  IF v_sem_sla > 0 THEN
    v_avisos := v_avisos || format('%s etapa(s) sem SLA configurado (usarão o SLA da fila dona).', v_sem_sla);
  END IF;

  -- Etapas órfãs (sem nenhuma ligação de entrada ou saída) quando há mais de uma etapa
  IF v_qtd_etapas > 1 THEN
    SELECT count(*) INTO v_orfas
      FROM public.processo_etapas pe
     WHERE pe.processo_id = _processo_id
       AND NOT EXISTS (
         SELECT 1 FROM public.processo_ligacoes pl
          WHERE pl.processo_id = _processo_id
            AND (pl.de_etapa_id = pe.id OR pl.para_etapa_id = pe.id)
       );
    IF v_orfas > 0 THEN
      v_avisos := v_avisos || format('%s etapa(s) sem ligação — o handoff não será automático.', v_orfas);
    END IF;
  END IF;

  -- Coerência com seções de projeto (quando há projeto_id_espelho na rotina)
  SELECT count(*) INTO v_secoes_inconsistentes
    FROM public.processo_etapas pe
    JOIN public.suporte_rotinas_fixas rf ON rf.id = pe.rotina_fixa_id
   WHERE pe.processo_id = _processo_id
     AND rf.projeto_id_espelho IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.projeto_secoes ps
        WHERE ps.projeto_id = rf.projeto_id_espelho
          AND ps.ordem = pe.ordem - 1
     );
  IF v_secoes_inconsistentes > 0 THEN
    v_avisos := v_avisos || format('%s etapa(s) sem seção correspondente no projeto vinculado.', v_secoes_inconsistentes);
  END IF;

  RETURN jsonb_build_object(
    'ok', array_length(v_erros, 1) IS NULL,
    'erros', to_jsonb(v_erros),
    'avisos', to_jsonb(v_avisos)
  );
END;
$$;

-- 3) Realtime para atualização imediata do painel
ALTER TABLE public.processo_execucao_etapas REPLICA IDENTITY FULL;
ALTER TABLE public.processo_tarefa_espelho REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'processo_execucao_etapas'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.processo_execucao_etapas';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'processo_tarefa_espelho'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.processo_tarefa_espelho';
  END IF;
END $$;