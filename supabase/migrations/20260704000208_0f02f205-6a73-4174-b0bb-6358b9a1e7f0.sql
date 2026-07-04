-- =====================================================================
-- SUPORTE ANALYTICS — engine de análise + KPIs + análises salvas
-- =====================================================================

-- ---------- 1. Horas úteis para o client (cálculo puro, sem PII) ----------
-- ATENÇÃO AUDITORIA: isto REVERTE deliberadamente o REVOKE da migration
-- 20260703181747. A função é STABLE SECURITY DEFINER, mas é cálculo puro:
-- lê apenas suporte_calendarios (config já legível por authenticated),
-- sem PII e sem SQL dinâmico. EXECUTE para authenticated é pré-requisito
-- das RPCs SECURITY INVOKER abaixo (INVOKER checa privilégio do caller).
GRANT EXECUTE ON FUNCTION public.suporte_horas_comerciais_entre(timestamptz, timestamptz, uuid) TO authenticated;

-- ---------- 2. RLS: métricas não podem "zerar" para agentes ----------
-- CSAT: hoje só o próprio autor + admin/suporte leem. Agente da fila do
-- ticket precisa ler para o dashboard do departamento (score é do
-- atendimento, não é PII sensível).
DROP POLICY IF EXISTS sup_csat_agente_fila ON public.suporte_csat;
CREATE POLICY sup_csat_agente_fila ON public.suporte_csat FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.suporte_tickets t
    WHERE t.id = suporte_csat.ticket_id
      AND public.is_agente_fila(auth.uid(), t.fila_id)
  )
);

-- Transferências: agente das filas de origem OU destino também lê a trilha.
DROP POLICY IF EXISTS sup_transf_agente_fila ON public.suporte_transferencias;
CREATE POLICY sup_transf_agente_fila ON public.suporte_transferencias FOR SELECT TO authenticated
USING (
  public.is_agente_fila(auth.uid(), de_fila_id)
  OR public.is_agente_fila(auth.uid(), para_fila_id)
);

-- CSAT: hardening ANTES de virar indicador executivo. A policy original de
-- INSERT só exigia user_id = auth.uid() — qualquer usuário podia inserir N
-- avaliações em QUALQUER ticket (vetor de manipulação de indicador).
-- Agora: 1 avaliação por (ticket, usuário) e só o solicitante do ticket
-- resolvido pode avaliar.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suporte_csat_unq') THEN
    ALTER TABLE public.suporte_csat ADD CONSTRAINT suporte_csat_unq UNIQUE (ticket_id, user_id);
  END IF;
END $$;

DROP POLICY IF EXISTS "User envia seu CSAT" ON public.suporte_csat;
DROP POLICY IF EXISTS sup_csat_insert ON public.suporte_csat;
CREATE POLICY sup_csat_insert ON public.suporte_csat FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.suporte_tickets t
    WHERE t.id = suporte_csat.ticket_id
      AND (t.requester_id = auth.uid() OR t.owner_id = auth.uid())
      AND t.status = 'resolvido'
  )
);

-- ---------- 3. RPC de KPIs executivos (uma chamada = todos os números) ----------
-- SECURITY INVOKER: a RLS de suporte_tickets decide o que o usuário vê
-- (agente = suas filas; admin/suporte = tudo; solicitante = os próprios).
CREATE OR REPLACE FUNCTION public.suporte_kpis(
  p_de date, p_ate date, p_fila_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH base AS (
    SELECT t.*, f.calendario_id
    FROM public.suporte_tickets t
    LEFT JOIN public.suporte_filas f ON f.id = t.fila_id
    -- janela no MESMO fuso dos buckets (SP), senão o dia executivo começa 21:00
    WHERE t.created_at >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND t.created_at <  ((p_ate + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
      AND (p_fila_id IS NULL OR t.fila_id = p_fila_id)
  )
  SELECT jsonb_build_object(
    'novos',            (SELECT count(*) FROM base),
    'resolvidos',       (SELECT count(*) FROM base WHERE resolved_at IS NOT NULL),
    'reabertos',        (SELECT count(*) FROM base WHERE reaberto_em IS NOT NULL),
    'escalados',        (SELECT count(*) FROM base WHERE escalado_em IS NOT NULL),
    'violados',         (SELECT count(*) FROM base WHERE sla_status = 'violado'),
    'frt_media_h',      (SELECT round(avg(public.suporte_horas_comerciais_entre(created_at, primeira_resposta_em, calendario_id)), 1)
                           FROM base WHERE primeira_resposta_em IS NOT NULL),
    'resolucao_media_h',(SELECT round(avg(public.suporte_horas_comerciais_entre(created_at, resolved_at, calendario_id)), 1)
                           FROM base WHERE resolved_at IS NOT NULL),
    'pct_sla_resolucao',(SELECT round(100.0 * count(*) FILTER (WHERE sla_status = 'cumprido')
                           / NULLIF(count(*) FILTER (WHERE resolved_at IS NOT NULL), 0), 1) FROM base),
    'pct_sla_primeira', (SELECT round(100.0 * count(*) FILTER (WHERE primeira_resposta_em <= prazo_primeira_resposta_em)
                           / NULLIF(count(*) FILTER (WHERE primeira_resposta_em IS NOT NULL AND prazo_primeira_resposta_em IS NOT NULL), 0), 1)
                           FROM base),
    'csat_media',       (SELECT round(avg(c.score)::numeric, 2) FROM public.suporte_csat c
                           WHERE c.ticket_id IN (SELECT id FROM base)),
    'csat_respostas',   (SELECT count(*) FROM public.suporte_csat c
                           WHERE c.ticket_id IN (SELECT id FROM base)),
    'transferencias',   (SELECT count(*) FROM public.suporte_transferencias tr
                           WHERE tr.ticket_id IN (SELECT id FROM base)),
    -- backlog é foto de AGORA (independe do período)
    'backlog_atual',    (SELECT count(*) FROM public.suporte_tickets t2
                           WHERE t2.status <> 'resolvido'
                             AND (p_fila_id IS NULL OR t2.fila_id = p_fila_id))
  );
$$;
REVOKE ALL ON FUNCTION public.suporte_kpis(date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suporte_kpis(date, date, uuid) TO authenticated;

-- ---------- 4. RPC genérica de análise (métrica × dimensão, whitelist) ----------
-- Mesmo padrão da vendas_analise: CASE-whitelist para expressões (nunca
-- interpolar entrada), valores via USING, SECURITY INVOKER (RLS decide).
CREATE OR REPLACE FUNCTION public.suporte_analise(
  p_metrica    text,
  p_dimensao   text,
  p_de         date,
  p_ate        date,
  p_fila_id    uuid DEFAULT NULL,
  p_canal      text DEFAULT NULL,
  p_prioridade text DEFAULT NULL,
  p_categoria  text DEFAULT NULL,
  p_limit      int  DEFAULT 50
) RETURNS TABLE(label text, valor numeric)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_dim   text;
  v_met   text;
  v_joins text := '';
BEGIN
  v_dim := CASE p_dimensao
    WHEN 'total'       THEN '''Total'''
    WHEN 'fila'        THEN 'COALESCE(f.nome, ''—'')'
    WHEN 'categoria'   THEN 'COALESCE(t.categoria, ''(sem categoria)'')'
    WHEN 'prioridade'  THEN 't.prioridade'
    WHEN 'status'      THEN 't.status'
    WHEN 'canal'       THEN 't.canal'
    WHEN 'sla'         THEN 'COALESCE(t.sla_status, ''—'')'
    WHEN 'agente'      THEN 'COALESCE(da.nome, ''(sem responsável)'')'
    WHEN 'solicitante' THEN 'COALESCE(dr.nome, ''—'')'
    WHEN 'tag'         THEN 'tg.tag'
    WHEN 'dia'         THEN 'to_char(t.created_at AT TIME ZONE ''America/Sao_Paulo'', ''YYYY-MM-DD'')'
    WHEN 'semana'      THEN 'to_char(t.created_at AT TIME ZONE ''America/Sao_Paulo'', ''IYYY-"S"IW'')'
    WHEN 'mes'         THEN 'to_char(t.created_at AT TIME ZONE ''America/Sao_Paulo'', ''YYYY-MM'')'
    ELSE NULL END;
  IF v_dim IS NULL THEN RAISE EXCEPTION 'dimensao invalida: %', p_dimensao; END IF;

  v_met := CASE p_metrica
    WHEN 'chamados'          THEN 'count(*)::numeric'
    WHEN 'resolvidos'        THEN '(count(*) FILTER (WHERE t.resolved_at IS NOT NULL))::numeric'
    WHEN 'reabertos'         THEN '(count(*) FILTER (WHERE t.reaberto_em IS NOT NULL))::numeric'
    WHEN 'frt_horas'         THEN 'round(avg(public.suporte_horas_comerciais_entre(t.created_at, t.primeira_resposta_em, f.calendario_id)) FILTER (WHERE t.primeira_resposta_em IS NOT NULL), 1)'
    WHEN 'resolucao_horas'   THEN 'round(avg(public.suporte_horas_comerciais_entre(t.created_at, t.resolved_at, f.calendario_id)) FILTER (WHERE t.resolved_at IS NOT NULL), 1)'
    WHEN 'pct_sla_resolucao' THEN 'round(100.0 * count(*) FILTER (WHERE t.sla_status = ''cumprido'') / NULLIF(count(*) FILTER (WHERE t.resolved_at IS NOT NULL), 0), 1)'
    WHEN 'pct_sla_primeira'  THEN 'round(100.0 * count(*) FILTER (WHERE t.primeira_resposta_em <= t.prazo_primeira_resposta_em) / NULLIF(count(*) FILTER (WHERE t.primeira_resposta_em IS NOT NULL AND t.prazo_primeira_resposta_em IS NOT NULL), 0), 1)'
    WHEN 'csat'              THEN 'round(avg(c.score)::numeric, 2)'
    WHEN 'transferencias'    THEN 'count(tr.id)::numeric'
    ELSE NULL END;
  IF v_met IS NULL THEN RAISE EXCEPTION 'metrica invalida: %', p_metrica; END IF;

  -- joins condicionais (evita inflar contagens quando não são necessários)
  IF p_dimensao = 'agente'      THEN v_joins := v_joins || ' LEFT JOIN public.get_chat_directory() da ON da.id = t.assignee_id '; END IF;
  IF p_dimensao = 'solicitante' THEN v_joins := v_joins || ' LEFT JOIN public.get_chat_directory() dr ON dr.id = COALESCE(t.requester_id, t.owner_id) '; END IF;
  IF p_dimensao = 'tag'         THEN v_joins := v_joins || ' CROSS JOIN LATERAL unnest(t.tags) AS tg(tag) '; END IF;
  IF p_metrica  = 'csat'        THEN v_joins := v_joins || ' LEFT JOIN public.suporte_csat c ON c.ticket_id = t.id '; END IF;
  IF p_metrica  = 'transferencias' THEN v_joins := v_joins || ' LEFT JOIN public.suporte_transferencias tr ON tr.ticket_id = t.id '; END IF;

  RETURN QUERY EXECUTE format(
    'SELECT %s AS label, %s AS valor
       FROM public.suporte_tickets t
       LEFT JOIN public.suporte_filas f ON f.id = t.fila_id
       %s
      WHERE t.created_at >= ($1::timestamp AT TIME ZONE ''America/Sao_Paulo'')
        AND t.created_at <  (($2 + 1)::timestamp AT TIME ZONE ''America/Sao_Paulo'')
        AND ($3::uuid IS NULL OR t.fila_id = $3)
        AND ($4::text IS NULL OR t.canal = $4)
        AND ($5::text IS NULL OR t.prioridade = $5)
        AND ($6::text IS NULL OR t.categoria = $6)
      GROUP BY 1
      HAVING %s IS NOT NULL
      ORDER BY 2 DESC NULLS LAST
      LIMIT $7',
    v_dim, v_met, v_joins, v_met
  ) USING p_de, p_ate, p_fila_id, p_canal, p_prioridade, p_categoria, GREATEST(1, LEAST(COALESCE(p_limit, 50), 400));
END;
$$;
REVOKE ALL ON FUNCTION public.suporte_analise(text, text, date, date, uuid, text, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suporte_analise(text, text, date, date, uuid, text, text, text, int) TO authenticated;

-- ---------- 5. Análises salvas (no BANCO, compartilháveis por departamento) ----------
-- Evolução sobre o construtor de Vendas (que salva só em localStorage).
CREATE TABLE IF NOT EXISTS public.suporte_analises_salvas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  nome          text NOT NULL CHECK (length(trim(nome)) > 0 AND length(nome) <= 120),
  descricao     text CHECK (length(coalesce(descricao,'')) <= 500),
  fila_id       uuid REFERENCES public.suporte_filas(id) ON DELETE SET NULL,
  compartilhada boolean NOT NULL DEFAULT false,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sup_analises_shared_scope CHECK (NOT compartilhada OR fila_id IS NOT NULL),
  CONSTRAINT sup_analises_config_size  CHECK (pg_column_size(config) <= 16384)
);

CREATE INDEX IF NOT EXISTS idx_sup_analises_user ON public.suporte_analises_salvas(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suporte_analises_salvas TO authenticated;
GRANT ALL ON public.suporte_analises_salvas TO service_role;

ALTER TABLE public.suporte_analises_salvas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sup_analises_own ON public.suporte_analises_salvas;
CREATE POLICY sup_analises_own ON public.suporte_analises_salvas FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sup_analises_shared ON public.suporte_analises_salvas;
CREATE POLICY sup_analises_shared ON public.suporte_analises_salvas FOR SELECT TO authenticated
USING (
  compartilhada AND fila_id IS NOT NULL AND (
    public.is_suporte_staff(auth.uid())
    OR public.is_agente_fila(auth.uid(), fila_id)
  )
);

DROP TRIGGER IF EXISTS trg_sup_analises_updated ON public.suporte_analises_salvas;
CREATE TRIGGER trg_sup_analises_updated BEFORE UPDATE ON public.suporte_analises_salvas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();