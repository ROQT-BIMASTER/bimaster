
-- Fase 5: RPC de monitoramento diario de execucao de processos

CREATE OR REPLACE FUNCTION public.rpc_processo_execucao_dia(
  _processo_id uuid,
  _data_ref date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date
)
RETURNS TABLE (
  etapa_id uuid,
  rotina_fixa_id uuid,
  rotina_titulo text,
  fila_id uuid,
  fila_nome text,
  fila_cor text,
  responsavel_user_id uuid,
  ordem integer,
  sla_minutos integer,
  execucao_id uuid,
  ticket_id uuid,
  status text,
  sla_deadline timestamptz,
  concluida_em timestamptz,
  sla_estourado boolean,
  minutos_para_deadline integer,
  handoff_pendente_de_etapa_id uuid,
  handoff_sla_minutos integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH etapas AS (
    SELECT pe.id AS etapa_id, pe.processo_id, pe.rotina_fixa_id, pe.ordem, pe.sla_minutos,
           rf.titulo AS rotina_titulo, rf.fila_id, rf.responsavel_user_id,
           sf.nome AS fila_nome, sf.cor AS fila_cor
    FROM public.processo_etapas pe
    JOIN public.suporte_rotinas_fixas rf ON rf.id = pe.rotina_fixa_id
    LEFT JOIN public.suporte_filas sf ON sf.id = rf.fila_id
    WHERE pe.processo_id = _processo_id
  ),
  execs AS (
    SELECT sre.rotina_id, sre.id AS execucao_id, sre.ticket_id, sre.status,
           sre.sla_deadline, sre.concluida_em
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
    LEFT JOIN execs ex_origem ON ex_origem.rotina_id = e_origem.rotina_fixa_id
    WHERE pl.processo_id = _processo_id
      AND (ex_origem.concluida_em IS NULL)
  ),
  handoff_min AS (
    SELECT etapa_id,
           (ARRAY_AGG(handoff_pendente_de_etapa_id ORDER BY handoff_sla_minutos NULLS LAST))[1] AS handoff_pendente_de_etapa_id,
           MIN(handoff_sla_minutos) AS handoff_sla_minutos
    FROM handoffs
    GROUP BY etapa_id
  )
  SELECT e.etapa_id, e.rotina_fixa_id, e.rotina_titulo, e.fila_id, e.fila_nome, e.fila_cor,
         e.responsavel_user_id, e.ordem, e.sla_minutos,
         ex.execucao_id, ex.ticket_id,
         COALESCE(ex.status, 'nao_gerada') AS status,
         ex.sla_deadline, ex.concluida_em,
         CASE
           WHEN ex.concluida_em IS NOT NULL THEN false
           WHEN ex.sla_deadline IS NOT NULL AND ex.sla_deadline < now() THEN true
           ELSE false
         END AS sla_estourado,
         CASE
           WHEN ex.sla_deadline IS NULL THEN NULL
           WHEN ex.concluida_em IS NOT NULL THEN NULL
           ELSE (EXTRACT(EPOCH FROM (ex.sla_deadline - now()))::integer / 60)
         END AS minutos_para_deadline,
         hm.handoff_pendente_de_etapa_id,
         hm.handoff_sla_minutos
  FROM etapas e
  LEFT JOIN execs ex ON ex.rotina_id = e.rotina_fixa_id
  LEFT JOIN handoff_min hm ON hm.etapa_id = e.etapa_id
  ORDER BY e.ordem, e.rotina_titulo;
$$;

REVOKE ALL ON FUNCTION public.rpc_processo_execucao_dia(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_processo_execucao_dia(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_processos_saude_dia(
  _data_ref date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date
)
RETURNS TABLE (
  processo_id uuid,
  processo_nome text,
  fila_dona_id uuid,
  total_etapas integer,
  concluidas integer,
  em_andamento integer,
  atrasadas integer,
  nao_geradas integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT po.id AS processo_id,
         po.nome AS processo_nome,
         po.fila_dona_id,
         COUNT(pe.id)::int AS total_etapas,
         COUNT(*) FILTER (WHERE sre.concluida_em IS NOT NULL)::int AS concluidas,
         COUNT(*) FILTER (WHERE sre.status IN ('gerada','em_andamento')
                          AND sre.concluida_em IS NULL
                          AND (sre.sla_deadline IS NULL OR sre.sla_deadline >= now()))::int AS em_andamento,
         COUNT(*) FILTER (WHERE sre.concluida_em IS NULL
                          AND sre.sla_deadline IS NOT NULL
                          AND sre.sla_deadline < now())::int AS atrasadas,
         COUNT(*) FILTER (WHERE sre.id IS NULL)::int AS nao_geradas
  FROM public.processos_operacionais po
  JOIN public.processo_etapas pe ON pe.processo_id = po.id
  LEFT JOIN public.suporte_rotina_execucoes sre
    ON sre.rotina_id = pe.rotina_fixa_id AND sre.data_referencia = _data_ref
  WHERE po.ativo = true
  GROUP BY po.id, po.nome, po.fila_dona_id
  ORDER BY po.nome;
$$;

REVOKE ALL ON FUNCTION public.rpc_processos_saude_dia(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_processos_saude_dia(date) TO authenticated, service_role;
