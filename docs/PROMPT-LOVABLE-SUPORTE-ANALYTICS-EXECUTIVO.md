# Prompt Lovable — Suporte · Analytics Executivo (dashboards por departamento + tabulações e relatórios configuráveis)

> **Cole no Lovable.** Depende das Fases 0–3B do Suporte. Entrega **visuais executivos de impacto por departamento**, **tabulações dinâmicas** (métrica × dimensão) e **relatórios configuráveis, salvos e exportáveis** — espelhando o padrão do **Construtor de Análises de Vendas** que o projeto já tem (RPC com whitelist + ECharts tema `rubyCorp` + galeria de presets), agora com **análises salvas no banco e compartilháveis por departamento**.
>
> São 2 partes: **PARTE 1 = migration** (engine de análise + KPIs + tabela de análises salvas + correções de RLS para métricas) e **PARTE 2 = frontend** (aba Visão Executiva + aba Análises + coleta de CSAT + exports). Aplicar a PARTE 1 primeiro.
>
> **Contexto de reuso (não recriar):** `src/lib/charts/corporateTheme.ts` (tema `rubyCorp`, `RUBYCORP_PALETTE`, `ensureRubyCorpTheme`, formatters), `src/components/vendas/AnaliseChart.tsx` (referência de UX — NÃO alterar; criar irmão para o Suporte), `src/pages/vendas/AnalisesBuilder.tsx` (referência de layout do construtor), `src/utils/excelExport.ts` (`exportToExcel` com `auditExport` integrado), padrão CSV de `src/lib/china/csvExporters.ts` (BOM UTF‑8 + `downloadBlob`), padrão PDF executivo de `src/lib/china/copilotPdf.ts` (jspdf + autotable, header/footer paginado). **Não usar o pacote `xlsx`** (banido — usar `exceljs` via `excelExport`). `recharts` do painel antigo não será usado aqui — o padrão executivo do projeto é **ECharts**.

---

## PARTE 1 — Migration (engine de análise do Suporte)

Crie **uma migration** com o SQL abaixo (idempotente). Justificativas de segurança nos comentários.

```sql
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
  fila_id       uuid REFERENCES public.suporte_filas(id) ON DELETE SET NULL, -- escopo opcional
  compartilhada boolean NOT NULL DEFAULT false,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb, -- { metrica, dimensao, tipo, periodo: '7d'|'30d'|'90d'|{de,ate}, canal?, prioridade?, categoria? }
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- compartilhar exige escopo de departamento (senão viraria "público p/ empresa toda")
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
```

### Smoke test da PARTE 1
```sql
-- (a) RPCs existem e são chamáveis por authenticated
SELECT proname FROM pg_proc WHERE proname IN ('suporte_kpis','suporte_analise') ORDER BY 1;
-- (b) engine funciona (como admin retorna linhas; períodos com dados)
SELECT * FROM public.suporte_analise('chamados','fila', (now() - interval '30 days')::date, now()::date);
SELECT public.suporte_kpis((now() - interval '30 days')::date, now()::date);
-- (c) whitelist bloqueia entrada inválida (esperado: EXCEPTION 'dimensao invalida')
SELECT * FROM public.suporte_analise('chamados','; DROP TABLE x;', now()::date, now()::date);
-- (d) tabela de análises salvas com RLS
SELECT relrowsecurity FROM pg_class WHERE relname = 'suporte_analises_salvas';
```

---

## PARTE 2 — Frontend (visuais executivos + construtor + CSAT + exports)

### 2.0 Tipos
Completar `SuporteChamado` em `src/hooks/suporte/types.ts` com os campos que já vêm do `select("*")` mas não estão declarados: `tags: string[]`, `reaberto_em: string | null`, `escalado_em: string | null`, `sentimento: string | null`, `sla_pausado_em: string | null`.

### 2.1 Componente de gráfico do Suporte — `SuporteAnaliseChart`
Criar `src/components/suporte/SuporteAnaliseChart.tsx` **espelhando** `src/components/vendas/AnaliseChart.tsx` (mesma UX: ECharts tema `rubyCorp` via `ensureRubyCorpTheme()`, barras viram horizontais quando `data.length > 8`, `tipo="table"` renderiza tabela HTML com coluna de % do total, botão de export PNG via `getDataURL()`), **sem alterar o componente de Vendas**. Diferenças:
- `tipo: "bar" | "line" | "area" | "pie" | "table"` (mesmos do AnaliseChart, sem treemap).
- Formatação por métrica do Suporte (novo `src/lib/suporte/analyticsFormat.ts`):
  - `chamados | resolvidos | reabertos | transferencias` → inteiro (`formatInt`);
  - `frt_horas | resolucao_horas` → `"12,5 h"`;
  - `pct_sla_resolucao | pct_sla_primeira` → `"94,0%"`;
  - `csat` → `"4,6 ★"`.
- Labels temporais: dimensão `dia` (`YYYY-MM-DD`) exibir `DD/MM`; `mes` (`YYYY-MM`) exibir `MMM/AA`; `semana` como vem. Reordenar ascendente no client quando a dimensão for temporal (mesmo comportamento de `src/hooks/useAnaliseRPC.ts` de Vendas — sort lexicográfico asc dos labels).

### 2.2 Hooks de dados — `src/hooks/suporte/useSuporteAnalytics.ts`
- `useSuporteKpis(de, ate, filaId?)` → `supabase.rpc("suporte_kpis", {...})`, `staleTime: 60_000`. Buscar **duas janelas** (atual e período imediatamente anterior de mesma duração) para os deltas dos KPIs.
- `useSuporteAnalise(params)` → `supabase.rpc("suporte_analise", {...})` com `queryKey: ["suporte","analise", params]`.
- `useAnalisesSalvas()` / `salvarAnalise` / `excluirAnalise` / `toggleCompartilhar` → CRUD em `suporte_analises_salvas` (dono edita; compartilhadas aparecem numa seção "Do departamento").

### 2.3 Central de Suporte — nova estrutura de abas
Na Central (`/dashboard/suporte/desk`): **substituir o `TabsList` de filas que existe hoje no `SuporteDesk.tsx` por um `Select` de departamento** (regras da spec `PROMPT-LOVABLE-SUPORTE-CENTRAL-DEPARTAMENTO.md`: agente travado na(s) sua(s) fila(s); admin/supervisor troca livremente + opção "Todos") — **não empilhar dois níveis de Tabs**. O componente `Tabs` passa a ser exclusivamente **Tickets | Visão Executiva | Análises**, e o Select de departamento + o filtro de período global (`7d | 30d | 90d | personalizado`, default 30d) escopam as 3 abas. Se a spec da Central ainda não tiver sido construída, construir junto nesta entrega.

### 2.4 Aba **Visão Executiva** (o "wow" do diretor)
Grade executiva, tudo ECharts `rubyCorp` (nada de recharts):
1. **6 KPI heroes** com **delta vs período anterior** (seta ↑↓ verde/vermelha e %): Backlog atual (sem delta), Novos, % SLA resolução, 1ª resposta média (h úteis), Resolução média (h úteis), CSAT (com nº de respostas em subtexto). Fonte: `useSuporteKpis` (2 janelas).
2. **Gauge de SLA** (`pct_sla_resolucao` do período) — ECharts gauge de 0–100% com faixas (vermelho <70, âmbar 70–90, verde >90). Registrar `GaugeChart` no próprio componente (import de `echarts/charts`), reusando o `echarts` re-exportado por `corporateTheme.ts`.
3. **Evolução diária** — área/linha `chamados` por `dia` + série `resolvidos` (2 chamadas `suporte_analise` com métricas diferentes, mescladas por label).
4. **Por categoria** — barra horizontal (`chamados` × `categoria`).
5. **Por departamento** — barra (`chamados` × `fila`) — exibir apenas quando seletor = "Todos".
6. **Fluxo de transferências (Sankey)** — visual executivo de destaque: origem→destino com volume. Fonte: `suporte_transferencias` direto do client (agora legível por agente/staff via nova policy), agregando `{de_fila_id → para_fila_id, count}` e resolvendo nomes com `useSuporteFilas`. Registrar `SankeyChart`. Fallback quando não houver transferências no período: estado vazio elegante ("Nenhuma transferência no período").
7. **CSAT** — distribuição 1–5 (barra) + média em destaque. Estado vazio: "Sem avaliações no período — as avaliações são coletadas ao resolver o chamado".
8. Botão **"Relatório executivo (PDF)"** — ver §2.7.

### 2.5 Aba **Análises** (tabulações configuráveis — espelho do construtor de Vendas)
Layout do `AnalisesBuilder` de Vendas (`grid lg:grid-cols-[320px_1fr]`):
- **Coluna esquerda** — card "Construtor": Select **Métrica** (9: Chamados, Resolvidos, Reabertos, 1ª resposta (h úteis), Resolução (h úteis), % SLA resolução, % SLA 1ª resposta, CSAT, Transferências), Select **Dimensão** (11: Departamento, Categoria, Prioridade, Status, Canal, Situação de SLA, Agente, Solicitante, Tag, Dia, Semana, Mês), ToggleGroup **Tipo** (bar/line/area/pie/table), filtros extras (canal, prioridade, categoria) e o período global. Card "Minhas análises" + card "Do departamento" (compartilhadas) — clicar aplica; dono pode renomear/excluir/compartilhar.
- **Coluna direita** — `SuporteAnaliseChart` (height 400) + barra de export: **PNG** (nativo), **CSV**, **Excel**, e "Salvar análise" (nome + toggle "Compartilhar com o departamento" + fila de escopo quando aplicável).
- **Galeria de presets** (Accordion por grupo, aplicar em 1 clique), definida em `src/lib/suporte/analisePresets.ts` com a mesma interface do de Vendas (`{id, titulo, grupo, metrica, dimensao, tipo, descricao?}`). Presets iniciais (24):
  - **SLA**: % SLA resolução por departamento (bar) · % SLA 1ª resposta por departamento (bar) · % SLA por prioridade (bar) · Situação de SLA — mix atual (pie) · % SLA resolução por mês (line)
  - **Volume**: Chamados por dia (area) · por mês (bar) · por departamento (bar) · por categoria (bar) · por canal (pie) · por status (pie) · por tag (bar)
  - **Tempos**: 1ª resposta média por departamento (bar) · por prioridade (bar) · Resolução média por departamento (bar) · por categoria (bar) · Resolução média por mês (line)
  - **Qualidade**: CSAT por departamento (bar) · CSAT por agente (bar) · Reabertos por departamento (bar) · Reabertos por mês (line)
  - **Fluxo & time**: Transferências por departamento (bar) · Chamados por agente (bar) · Resolvidos por agente (bar)

### 2.5b Semânticas documentadas (exibir como tooltip/nota nos presets correspondentes)
- **Transferências por departamento** conta transferências sofridas por tickets **hoje na fila X** (agrupamento pela fila atual do ticket, não pela origem/destino do movimento). O fluxo origem→destino fica no **Sankey** da Visão Executiva.
- **CSAT** é média **por resposta** (coerente com `csat_respostas`), não por ticket.
- **Chamados por agente**: tickets de ex-funcionários (perfil inativo) aparecem como "(sem responsável)" — o diretório oculta usuários desativados.

### 2.6 Coleta de CSAT (sem ela, o dashboard nasce vazio)
Em `SuporteMeusChamados`, quando o chamado selecionado tem `status='resolvido'` e o usuário ainda não avaliou (query em `suporte_csat` por `ticket_id`+`user_id`): exibir card acima da thread — "Como foi o atendimento?" com **5 estrelas** + comentário opcional + enviar (INSERT direto em `suporte_csat`; a RLS já permite o próprio usuário inserir). Após enviar: "Obrigado pela avaliação ★N". Componente `src/components/suporte/CsatPrompt.tsx`.

### 2.7 Exports (padrões do projeto)
- **CSV**: builder no padrão de `csvExporters.ts` (BOM UTF‑8, `esc()`, `downloadBlob`) — colunas Label/Valor da análise corrente + cabeçalho com título, período e filtros.
- **Excel**: `exportToExcel` de `src/utils/excelExport.ts` (exceljs; **auditoria automática** via `auditExport`).
- **PDF executivo** (`src/lib/suporte/exportRelatorioSuporte.ts`, padrão `copilotPdf.ts`): capa com faixa `BRAND_BASE` + título "Relatório de Suporte — {Departamento|Todos}" + período; grade de KPI cards (valores de `suporte_kpis` + deltas); gráficos embutidos como imagem (`getDataURL()` dos charts ECharts renderizados); tabela `jspdf-autotable` da análise em foco; rodapé com autor + data (pt‑BR, America/Sao_Paulo) + "Página N de M". Config-lite espelhando `BriefingExportConfig` (definido em `src/lib/briefings/exportTypes.ts`): `{ titulo, incluir: { kpis, evolucao, categorias, sla, csat, transferencias, tabela } }` num popover antes de gerar.

### 2.8 Realtime/limites
- As RPCs agregam no banco — **sem** o teto de 500 tickets do client. As abas analíticas **não** precisam de realtime (dados de gestão): `staleTime` 60s + refetch ao trocar filtros já bastam.

## Aceite (teste no app)
1. Como **admin** em "Todos": KPIs com deltas, gauge de SLA, evolução, categorias, por-departamento, Sankey de transferências e CSAT renderizam para o período; trocar para **Fiscal** re-escopa tudo.
2. Como **agente de 1 fila**: vê os números da sua fila **+ os chamados que ele próprio abriu em outras** (comportamento da RLS — correto). Conferir que NÃO vê chamados de outras filas que não são dele.
3. Construtor: montar "CSAT por agente" do zero, salvar compartilhada, ver na seção "Do departamento" de outro agente da fila.
4. Presets: aplicar 3 presets de grupos diferentes em 1 clique.
5. Exports: PNG, CSV (abre no Excel pt‑BR com acentos ok), Excel e PDF executivo com KPIs + gráfico + tabela.
6. Resolver um chamado → avaliar com 4★ → CSAT aparece nos KPIs/gráficos.
7. Smoke (c) da PARTE 1: entrada fora da whitelist gera exceção (sem injeção).

## Fora de escopo (evoluções)
- Pivot 2D (dimensão em linha × coluna) — a engine aceita evoluir com `p_dimensao2`.
- Agendamento de envio de relatório por e-mail.
- Metas por departamento (target de SLA/CSAT configurável com linha de meta nos gráficos).
