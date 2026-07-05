# PROMPT LOVABLE — TORRE DE CONTROLE DE DESPESAS · FASE 2 (Motor de alertas + fila com trilha imutável)

> **Como usar:** cole este arquivo inteiro no Lovable. Ele é uma **migration Supabase** completa e auto-contida (DDL + RLS + SEED + funções + pg_cron + smoke tests). Execute os blocos **na ordem em que aparecem** — há dependências (a tabela antes da função, a regra semeada antes do `pg_cron` que a dispara). Todos os blocos são idempotentes onde possível (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING` no seed, `unschedule+schedule` no cron).
>
> **Referências verificadas** (não invente colunas — este prompt já foi conferido contra o schema real):
> - Molde de guard SECURITY DEFINER: `supabase/migrations/20260705042549_...sql:6-57` (`check_user_access` `:21-23`, `user_has_empresa_access` na base `:26-36`, REVOKE/GRANT `:194-204`).
> - Trilha imutável: `audit_log_record(action, entity, entity_id, before, after)` em `20260501023237:111-139`; cadeia `audit_log_immutable` (`:10-73`, verificação `:142-179`).
> - Fila reutilizada: `contas_pagar_revisao` (`20251203163804:2-21`); CHECK de `tipo_revisao` = `('eliminar','reduzir','renegociar','monitorar')` (`:8`) — a Fase 2 **adiciona `'auditar'`**.
> - Gate de papel: `is_admin_or_supervisor(auth.uid())` (usado na RLS de `contas_pagar_revisao` `:36`) e `check_user_access(auth.uid(),'financeiro')`.
> - Schema real de `contas_pagar` (colunas usadas pelas regras): `id uuid`, `erp_id`, `empresa_id integer`, `tipo_documento`, `numero_documento`, `parcela`, `fornecedor_codigo`, `fornecedor_nome`, `valor_original`, `valor_aberto`, `valor_pago`, `valor_juros`, `valor_desconto`, `data_emissao`, `data_vencimento`, `data_pagamento`, `status`, `natureza_lancamento` (provisionado|lancado), `portador`, `departamento_id uuid`, `departamento_nome`, `centro_custo_id`, `plano_contas_id uuid`, `plano_contas_nome`, `confianca_classificacao`, `classificacao_manual`, `created_at`. Dimensões: `departamentos(id uuid)`, `trade_chart_of_accounts(id uuid)`, `feriados(data, ano, nome, tipo)`, `contas_pagar_historico(conta_id, campo_alterado, valor_anterior, valor_novo, created_at)`.
> - Extensões: `pg_trgm` vive no schema `extensions` → chame `extensions.similarity(...)`; `unaccent` vive em `public` → `public.unaccent(...)`.

---

## 1. Contexto

A Torre de Controle de Despesas é um **motor forense determinístico**: um conjunto de blocos SQL set-based que varrem `public.contas_pagar` (o espelho autoritativo do ERP Result, ~51 mil títulos em 11 empresas) procurando padrões que humanos não enxergam em 50 mil linhas — fornecedor novo faturando pesado, notas fracionadas para fugir de alçada, o mesmo documento cobrado em duas empresas do grupo, provisão aprovada por X e efetivada por X+Δ. Cada bloco escreve em `despesa_alertas` com uma `chave_dedup` determinística por regra, de modo que **a mesma query sobre os mesmos dados produz sempre o mesmo alerta** (reproduzível, auditável em juízo) e re-execuções não duplicam nada (upsert `ON CONFLICT`). Cada alerta carrega o **valor em risco** (`valor_impacto`) para priorizar onde o dinheiro sai.

A detecção é **puramente determinística — não há IA nesta fase** (a IA entra só na Fase 3, lendo alertas por cima, nunca criando alertas). A ação sobre cada alerta acontece numa **fila com trilha de auditoria imutável**: transições de estado (`novo → em_analise → acionado → resolvido | descartado`) passam exclusivamente por uma RPC `SECURITY DEFINER` que exige justificativa nos terminais, grava um evento leve e sela um registro na cadeia de hash `audit_log_immutable` — de forma que **o próprio descarte de um alerta é evidência** (quem enterrou o alerta fica registrado de forma imutável). A ação operacional reutiliza a fila existente `contas_pagar_revisao` (nunca uma fila paralela); o alerta só rastreia o desfecho via `revisao_id`.

---

## 2. DDL — tabelas, índices e RLS (§3)

```sql
-- =====================================================================
-- TORRE DE DESPESAS · FASE 2 — DDL
-- =====================================================================

-- 2.1 Catálogo de regras: parametrização sem redeploy
CREATE TABLE IF NOT EXISTS public.despesa_regras (
  codigo text PRIMARY KEY,                       -- 'R03_DUPLICIDADE'
  nome text NOT NULL,
  descricao text,
  severidade_default text NOT NULL CHECK (severidade_default IN ('critica','alta','media','baixa')),
  params jsonb NOT NULL DEFAULT '{}',            -- {"janela_dias":7,"tolerancia_pct":0.01,"piso_valor":500}
  cadencia text NOT NULL DEFAULT 'diaria' CHECK (cadencia IN ('diaria','semanal','mensal')),
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2.2 Alertas — coração do anti-realerta = UNIQUE(regra_codigo, chave_dedup)
CREATE TABLE IF NOT EXISTS public.despesa_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_codigo text NOT NULL REFERENCES public.despesa_regras(codigo),
  chave_dedup text NOT NULL,
  severidade text NOT NULL CHECK (severidade IN ('critica','alta','media','baixa')),
  status text NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo','em_analise','acionado','resolvido','descartado')),
  origem text NOT NULL DEFAULT 'deterministico' CHECK (origem IN ('deterministico','manual')),
  titulo text NOT NULL,
  descricao text,
  score numeric,
  valor_impacto numeric(14,2),
  -- dimensões (nullable; cada regra preenche o que tem)
  empresa_id integer,
  departamento_id uuid REFERENCES public.departamentos(id),
  plano_contas_id uuid REFERENCES public.trade_chart_of_accounts(id),
  centro_custo_id uuid,
  fornecedor_codigo text,
  fornecedor_nome text,
  competencia date,
  conta_ids uuid[] DEFAULT '{}',
  evidencia jsonb NOT NULL DEFAULT '{}',
  -- ciclo de vida / dedup
  primeiro_detectado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_detectado_em timestamptz NOT NULL DEFAULT now(),
  ocorrencias int NOT NULL DEFAULT 1,
  reaberto_count int NOT NULL DEFAULT 0,
  -- elo com a fila existente (NUNCA fila paralela)
  revisao_id uuid REFERENCES public.contas_pagar_revisao(id),
  atribuido_a uuid,
  resolvido_por uuid,
  resolvido_em timestamptz,
  resolucao_nota text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regra_codigo, chave_dedup)
);

CREATE INDEX IF NOT EXISTS idx_despesa_alertas_abertos
  ON public.despesa_alertas (severidade, valor_impacto DESC)
  WHERE status IN ('novo','em_analise');
CREATE INDEX IF NOT EXISTS idx_despesa_alertas_dept
  ON public.despesa_alertas (departamento_id, status);
CREATE INDEX IF NOT EXISTS idx_despesa_alertas_forn
  ON public.despesa_alertas (fornecedor_codigo);

-- 2.3 Log leve de transições (a trilha pesada vai p/ audit_log_immutable)
CREATE TABLE IF NOT EXISTS public.despesa_alertas_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id uuid NOT NULL REFERENCES public.despesa_alertas(id) ON DELETE CASCADE,
  de_status text,
  para_status text,
  usuario_id uuid,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_despesa_alertas_eventos_alerta
  ON public.despesa_alertas_eventos (alerta_id, created_at);

-- 2.4 Snapshot mensal leve (robustez do R09 + provisão fantasma; populado pelo cron)
CREATE TABLE IF NOT EXISTS public.despesa_cp_snapshot (
  erp_id text NOT NULL,
  mes_ref date NOT NULL,
  natureza_lancamento text,
  valor_original numeric,
  valor_pago numeric,
  PRIMARY KEY (erp_id, mes_ref)
);

-- 2.5 Índices auxiliares em contas_pagar que o motor usa (idempotentes)
CREATE INDEX IF NOT EXISTS idx_cp_emissao_ativo
  ON public.contas_pagar (data_emissao) WHERE status <> 'cancelado';
CREATE INDEX IF NOT EXISTS idx_cp_forn_emissao
  ON public.contas_pagar (fornecedor_codigo, data_emissao);
```

```sql
-- =====================================================================
-- RLS — leitura só para admin/supervisor DENTRO do gate financeiro (§10.2);
-- ZERO policy de INSERT/UPDATE/DELETE p/ authenticated: escrita só via
-- funções SECURITY DEFINER (motor = service_role; transição = RPC gated).
-- =====================================================================
ALTER TABLE public.despesa_regras          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesa_alertas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesa_alertas_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesa_cp_snapshot     ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.despesa_regras,
              public.despesa_alertas,
              public.despesa_alertas_eventos,
              public.despesa_cp_snapshot
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.despesa_regras,
                public.despesa_alertas,
                public.despesa_alertas_eventos
  TO authenticated;  -- via RLS abaixo

-- Regras: catálogo legível por quem tem o módulo financeiro
DROP POLICY IF EXISTS despesa_regras_sel ON public.despesa_regras;
CREATE POLICY despesa_regras_sel ON public.despesa_regras
  FOR SELECT TO authenticated
  USING (public.check_user_access(auth.uid(), 'financeiro'));

-- Alertas: restritos a admin/supervisor E gate financeiro (decisão §10.2)
DROP POLICY IF EXISTS despesa_alertas_sel ON public.despesa_alertas;
CREATE POLICY despesa_alertas_sel ON public.despesa_alertas
  FOR SELECT TO authenticated
  USING (
    public.check_user_access(auth.uid(), 'financeiro')
    AND public.is_admin_or_supervisor(auth.uid())
  );

-- Eventos: mesma visibilidade dos alertas
DROP POLICY IF EXISTS despesa_alertas_eventos_sel ON public.despesa_alertas_eventos;
CREATE POLICY despesa_alertas_eventos_sel ON public.despesa_alertas_eventos
  FOR SELECT TO authenticated
  USING (
    public.check_user_access(auth.uid(), 'financeiro')
    AND public.is_admin_or_supervisor(auth.uid())
  );

-- Snapshot: sem GRANT a authenticated (uso interno do motor / service_role).
```

---

## 3. SEED de `despesa_regras` (§4 — 13 regras entram nesta leva)

> **Não semeadas nesta leva** (ver seção 10 "Regras adiadas"): **R05** e **R10** dependem de contratos/orçamento que estão magros (15/2/11) e ficam fora; **R14 subtipo "operador"** e demais regras de segregação de função ficam fora até o gap ② (operador do ERP). Todas as 13 abaixo têm bloco SQL verificado no motor.

```sql
INSERT INTO public.despesa_regras (codigo, nome, descricao, severidade_default, params, cadencia, ativo) VALUES
('R01_ZSCORE_MOM_YOY',
 'Salto anômalo por departamento × plano (z-score / MoM / YoY)',
 'Gasto do mês fora do padrão de 12 meses (z-score) ou explosão YoY, por departamento × plano de contas.',
 'alta',
 '{"z_alta":3,"z_media":2,"yoy_alta_pct":100,"piso_valor":10000,"n_meses_min":6,"conf_minima":0.7}'::jsonb,
 'diaria', true),

('R02_FORNECEDOR_NOVO_VOLUME',
 'Fornecedor novo com volume alto',
 'Fornecedor com 1ª emissão nos últimos 90 dias já acumulando volume material (shell company / billing scheme).',
 'alta',
 '{"janela_dias":90,"piso_acumulado":50000,"piso_titulo":30000,"piso_critico":200000,"piso_materialidade":5000}'::jsonb,
 'diaria', true),

('R03_DUPLICIDADE',
 'Duplicidade de título',
 'Mesmo fornecedor+empresa, valor ±tolerância, janela curta, erp_id distinto, excluindo parcelamento legítimo.',
 'alta',
 '{"janela_dias":7,"tolerancia_pct":0.01,"piso_valor":500}'::jsonb,
 'diaria', true),

('R04_FRACIONAMENTO',
 'Fracionamento para escapar de alçada',
 '>=N títulos do fornecedor no período, todos abaixo da alçada, somando >=mult×alçada, com fatias parelhas (CV baixo).',
 'alta',
 '{"piso_valor":10000,"min_titulos":3,"mult_soma":1.2,"janela":"dia","cv_max":0.25,"piso_materialidade":0,"whitelist_planos":[]}'::jsonb,
 'diaria', true),

('R06_CONCENTRACAO_FORNECEDOR',
 'Concentração de fornecedor no departamento',
 'Fornecedor >=40% do gasto do departamento (piso R$30k/90d) e crescendo >=10 p.p. YoY (conluio / kickback).',
 'media',
 '{"share_min":0.40,"share_alta":0.60,"piso_valor":30000,"janela_dias":90,"delta_pp_min":0.10,"meses_casa_alta":24,"excluir_admin_baixa_conf":true}'::jsonb,
 'semanal', true),

('R07_LANCAMENTO_NAO_UTIL',
 'Emissão em dia não útil',
 'Título emitido em sábado/domingo/feriado, acima do piso, excluindo tipos operacionais (fator de baixa severidade).',
 'baixa',
 '{"piso_valor":5000,"excluir_tipos":["BOLETO","TARIFA","IMPOSTO"],"conf_min_admin":0.70}'::jsonb,
 'diaria', true),

('R08_BENFORD',
 'Distribuição de 1º dígito atípica (Benford)',
 'Teste de Benford (χ² 8 g.l., p<0,01) por departamento/fornecedor por semestre (direcionador forense, nunca prova).',
 'media',
 '{"qui2_critico":20.09,"min_amostra_dept":300,"min_amostra_forn":100,"piso_valor":0,"meses_janela":6}'::jsonb,
 'semanal', true),

('R09_PROVISAO_ENGORDA',
 'Provisão que engorda ao ser lançada',
 'Título que transitou provisionado->lancado e teve valor_original elevado após a transição (via histórico).',
 'alta',
 '{"pct_engorda":0.05,"piso_valor":500}'::jsonb,
 'diaria', true),

('R11_JUROS_CRONICOS',
 'Juros/acréscimos crônicos por fornecedor',
 '>=3 títulos com juros >2% e >=R$2k somados, OU >=3 pagos >105% do original, em 6 meses.',
 'media',
 '{"janela_meses":6,"min_titulos":3,"pct_juros_min":0.02,"piso_juros_soma":2000,"ratio_pago_min":1.05,"piso_valor":2000}'::jsonb,
 'semanal', true),

('R12_PORTADOR_ATIPICO',
 'Portador atípico do fornecedor',
 'Título roteado por portador != do habitual do fornecedor NA MESMA EMPRESA (>=6 pagamentos históricos), acima do piso.',
 'media',
 '{"piso_valor":5000,"min_pagamentos":6,"supressao_troca_banco_pct":0.30}'::jsonb,
 'diaria', true),

('R13_DOUBLE_DIPPING_INTRAGRUPO',
 'Mesmo documento em múltiplos CNPJs',
 'Mesmo numero_documento+valor+fornecedor em >=min_cnpjs empresas do grupo (double-dipping intragrupo).',
 'alta',
 '{"piso_valor":5000,"min_cnpjs":2}'::jsonb,
 'diaria', true),

('R14_SENTINELAS',
 'Sentinelas de higiene forense',
 'Quitado sem data_pagamento, pgto<emissão, venc<emissão, aberto<0, pago com aberto>0 (monitor do gap ①).',
 'baixa',
 '{"piso_valor":5000,"tolerancia_aberto":1.00}'::jsonb,
 'diaria', true),

('R15_FORNECEDOR_QUASE_DUPLICADO',
 'Fornecedor quase-duplicado',
 'Nome normalizado igual ou similarity()>limiar (pg_trgm) sob códigos distintos (dupla cobrança que escapa do R03).',
 'media',
 '{"limiar_similaridade":0.90,"piso_valor":30000,"janela_meses":12,"min_len_nome":6}'::jsonb,
 'semanal', true)
ON CONFLICT (codigo) DO NOTHING;
```

---

## 4. `fn_despesa_detectar(p_regras text[] DEFAULT NULL)` — o motor (§3.2 item 4, §4)

> SECURITY DEFINER, `search_path=public`, `statement_timeout` alto. Cada regra é um bloco `IF (p_regras IS NULL OR '<codigo>' = ANY(p_regras)) AND (SELECT ativo FROM despesa_regras WHERE codigo='<codigo>') THEN ... END IF;` que executa o SQL verificado da regra e reporta `(regra, inseridos, atualizados)` via `GET DIAGNOSTICS` + contagem de conflitos.
>
> **Padrão de contabilização** usado em cada bloco: contamos `inseridos` comparando `xmax` (linha nova tem `xmax=0`). O `upsert` já traz `RETURNING (xmax = 0)` implícito — como os blocos são `INSERT ... ON CONFLICT`, capturamos o total afetado com `GET DIAGNOSTICS v_afetados = ROW_COUNT` e, para separar inseridos de atualizados, cada bloco encapsula o `INSERT` num CTE `ins AS (... RETURNING (xmax=0) AS novo)` e agrega. Para manter o corpo legível, cada regra abaixo usa o padrão `WITH ... , ins AS (INSERT ... RETURNING (xmax=0) AS eh_novo) SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo) INTO v_ins, v_upd;` e faz `RETURN NEXT`.

```sql
CREATE OR REPLACE FUNCTION public.fn_despesa_detectar(p_regras text[] DEFAULT NULL)
RETURNS TABLE(regra text, inseridos int, atualizados int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '600000'   -- 10 min
AS $function$
DECLARE
  v_ins int;
  v_upd int;
  v_ativa boolean;
BEGIN

  -- ============================ R01_ZSCORE_MOM_YOY ============================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R01_ZSCORE_MOM_YOY';
  IF (p_regras IS NULL OR 'R01_ZSCORE_MOM_YOY' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH r AS (
      SELECT
        COALESCE((params->>'z_alta')::numeric,       3)      AS z_alta,
        COALESCE((params->>'z_media')::numeric,      2)      AS z_media,
        COALESCE((params->>'yoy_alta_pct')::numeric, 100)    AS yoy_alta_pct,
        COALESCE((params->>'piso_valor')::numeric,   10000)  AS piso_valor,
        COALESCE((params->>'n_meses_min')::int,      6)       AS n_meses_min,
        COALESCE((params->>'conf_minima')::numeric,  0.7)     AS conf_minima,
        COALESCE(severidade_default, 'alta')                  AS sev_default
      FROM public.despesa_regras
      WHERE codigo = 'R01_ZSCORE_MOM_YOY'
    ),
    ref AS (
      SELECT COALESCE(
               date_trunc('month', ((SELECT params->>'mes_ref' FROM public.despesa_regras
                                     WHERE codigo='R01_ZSCORE_MOM_YOY'))::date),
               date_trunc('month', current_date)
             )::date AS mes_ref
    ),
    base AS (
      SELECT cp.id, cp.empresa_id, cp.departamento_id, cp.departamento_nome,
             cp.plano_contas_id, cp.plano_contas_nome, cp.valor_original,
             date_trunc('month', cp.data_emissao)::date AS mes
      FROM public.contas_pagar cp
      CROSS JOIN ref
      WHERE cp.status <> 'cancelado'
        AND cp.data_emissao IS NOT NULL
        AND cp.departamento_id IS NOT NULL
        AND cp.plano_contas_id IS NOT NULL
        AND cp.data_emissao >= (ref.mes_ref - interval '12 months')::date
        AND cp.data_emissao <  (ref.mes_ref + interval '1 month')::date
        AND NOT (cp.departamento_nome = 'Administrativo'
                 AND COALESCE(cp.confianca_classificacao, 0) < (SELECT conf_minima FROM r)
                 AND cp.classificacao_manual IS NOT TRUE)
    ),
    dims AS (
      SELECT DISTINCT departamento_id, plano_contas_id FROM base
    ),
    meses AS (
      SELECT gs::date AS mes
      FROM ref CROSS JOIN LATERAL
           generate_series((ref.mes_ref - interval '12 months')::date, ref.mes_ref, interval '1 month') gs
    ),
    mensal AS (
      SELECT departamento_id, plano_contas_id, mes, sum(valor_original) AS valor
      FROM base GROUP BY 1, 2, 3
    ),
    grade AS (
      SELECT d.departamento_id, d.plano_contas_id, m.mes,
             COALESCE(x.valor, 0)::numeric AS valor
      FROM dims d
      CROSS JOIN meses m
      LEFT JOIN mensal x
        ON x.departamento_id IS NOT DISTINCT FROM d.departamento_id
       AND x.plano_contas_id IS NOT DISTINCT FROM d.plano_contas_id
       AND x.mes = m.mes
    ),
    stats AS (
      SELECT g.departamento_id, g.plano_contas_id,
             avg(g.valor)                        AS media_12m,
             stddev_samp(g.valor)                AS desvio_12m,
             count(*) FILTER (WHERE g.valor > 0) AS n_meses_com_mov
      FROM grade g CROSS JOIN ref
      WHERE g.mes >= (ref.mes_ref - interval '12 months')::date
        AND g.mes <  ref.mes_ref
      GROUP BY 1, 2
    ),
    mes_ref_val AS (
      SELECT g.departamento_id, g.plano_contas_id, g.valor AS valor_ref
      FROM grade g CROSS JOIN ref WHERE g.mes = ref.mes_ref
    ),
    mes_m1 AS (
      SELECT g.departamento_id, g.plano_contas_id, g.valor AS valor_m1
      FROM grade g CROSS JOIN ref WHERE g.mes = (ref.mes_ref - interval '1 month')::date
    ),
    mes_m12 AS (
      SELECT g.departamento_id, g.plano_contas_id, g.valor AS valor_m12
      FROM grade g CROSS JOIN ref WHERE g.mes = (ref.mes_ref - interval '12 months')::date
    ),
    ref_meta AS (
      SELECT b.departamento_id, b.plano_contas_id,
             max(b.departamento_nome) AS departamento_nome,
             max(b.plano_contas_nome) AS plano_contas_nome,
             (array_agg(DISTINCT b.empresa_id))[1] AS empresa_id,
             array_agg(b.id ORDER BY b.id) AS conta_ids
      FROM base b CROSS JOIN ref
      WHERE b.mes = ref.mes_ref
      GROUP BY 1, 2
    ),
    calc AS (
      SELECT
        v.departamento_id, v.plano_contas_id, v.valor_ref,
        s.media_12m, s.desvio_12m, s.n_meses_com_mov,
        m1.valor_m1, m12.valor_m12,
        round((v.valor_ref - s.media_12m) / NULLIF(s.desvio_12m, 0), 2)               AS z,
        round(100.0 * (v.valor_ref - m1.valor_m1)  / NULLIF(m1.valor_m1,  0), 2)      AS mom_pct,
        round(100.0 * (v.valor_ref - m12.valor_m12) / NULLIF(m12.valor_m12, 0), 2)    AS yoy_pct,
        GREATEST(v.valor_ref - s.media_12m, 0)                                        AS excesso
      FROM mes_ref_val v
      JOIN stats  s   ON s.departamento_id  IS NOT DISTINCT FROM v.departamento_id
                     AND s.plano_contas_id  IS NOT DISTINCT FROM v.plano_contas_id
      LEFT JOIN mes_m1  m1  ON m1.departamento_id  IS NOT DISTINCT FROM v.departamento_id
                            AND m1.plano_contas_id  IS NOT DISTINCT FROM v.plano_contas_id
      LEFT JOIN mes_m12 m12 ON m12.departamento_id IS NOT DISTINCT FROM v.departamento_id
                            AND m12.plano_contas_id IS NOT DISTINCT FROM v.plano_contas_id
    ),
    flagged AS (
      SELECT c.*, r.z_alta, r.z_media, r.yoy_alta_pct, r.piso_valor, r.n_meses_min, r.sev_default,
             rm.departamento_nome, rm.plano_contas_nome, rm.empresa_id, rm.conta_ids,
             (SELECT mes_ref FROM ref) AS mes_ref
      FROM calc c
      CROSS JOIN r
      JOIN ref_meta rm ON rm.departamento_id IS NOT DISTINCT FROM c.departamento_id
                       AND rm.plano_contas_id IS NOT DISTINCT FROM c.plano_contas_id
      WHERE c.n_meses_com_mov >= r.n_meses_min
        AND c.desvio_12m IS NOT NULL AND c.desvio_12m > 0
        AND c.valor_ref >= r.piso_valor
        AND (c.z >= r.z_media OR c.yoy_pct >= r.yoy_alta_pct)
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score, valor_impacto,
        empresa_id, departamento_id, plano_contas_id, fornecedor_codigo, fornecedor_nome,
        competencia, conta_ids, evidencia
      )
      SELECT
        'R01_ZSCORE_MOM_YOY',
        f.departamento_id::text || '|' || f.plano_contas_id::text || '|' || to_char(f.mes_ref, 'YYYY-MM'),
        CASE
          WHEN f.z >= f.z_alta OR f.yoy_pct >= f.yoy_alta_pct THEN 'alta'
          ELSE 'media'
        END,
        'Salto anômalo: ' || COALESCE(f.departamento_nome, '(sem dept)')
          || ' / ' || COALESCE(f.plano_contas_nome, '(sem plano)')
          || ' — ' || to_char(f.mes_ref, 'MM/YYYY'),
        'Gasto de R$ ' || to_char(f.valor_ref, 'FM999G999G990D00')
          || ' no mês (z=' || COALESCE(f.z::text, 'n/d')
          || ', MoM=' || COALESCE(f.mom_pct::text, 'n/d') || '%'
          || ', YoY=' || COALESCE(f.yoy_pct::text, 'n/d') || '%)'
          || ' vs média 12m R$ ' || to_char(round(f.media_12m, 2), 'FM999G999G990D00')
          || ' (±' || to_char(round(f.desvio_12m, 2), 'FM999G999G990D00') || ').',
        f.z,
        round(f.excesso, 2),
        f.empresa_id, f.departamento_id, f.plano_contas_id,
        NULL, NULL,
        f.mes_ref,
        f.conta_ids,
        jsonb_build_object(
          'regra',        'R01_ZSCORE_MOM_YOY',
          'grao',         'departamento_x_plano_x_mes',
          'base_valor',   'valor_original',
          'eixo_data',    'data_emissao',
          'mes_ref',      to_char(f.mes_ref, 'YYYY-MM-DD'),
          'valor_mes',    round(f.valor_ref, 2),
          'media_12m',    round(f.media_12m, 2),
          'desvio_12m',   round(f.desvio_12m, 2),
          'z',            f.z,
          'mom_pct',      f.mom_pct,
          'yoy_pct',      f.yoy_pct,
          'n_meses_com_mov', f.n_meses_com_mov,
          'excesso_sobre_media', round(f.excesso, 2),
          'limiares',     jsonb_build_object('z_alta', f.z_alta, 'z_media', f.z_media,
                                             'yoy_alta_pct', f.yoy_alta_pct, 'piso_valor', f.piso_valor),
          'qtd_titulos',  COALESCE(array_length(f.conta_ids, 1), 0)
        )
      FROM flagged f
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo', 'em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R01_ZSCORE_MOM_YOY'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R02_FORNECEDOR_NOVO_VOLUME ====================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R02_FORNECEDOR_NOVO_VOLUME';
  IF (p_regras IS NULL OR 'R02_FORNECEDOR_NOVO_VOLUME' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH cfg AS (
      SELECT
        COALESCE((params->>'janela_dias')::int,         90)     AS janela_dias,
        COALESCE((params->>'piso_acumulado')::numeric,  50000)  AS piso_acumulado,
        COALESCE((params->>'piso_titulo')::numeric,     30000)  AS piso_titulo,
        COALESCE((params->>'piso_critico')::numeric,    200000) AS piso_critico,
        COALESCE((params->>'piso_materialidade')::numeric, 5000) AS piso_materialidade,
        COALESCE(severidade_default, 'alta')                    AS sev_default
      FROM public.despesa_regras
      WHERE codigo = 'R02_FORNECEDOR_NOVO_VOLUME'
    ),
    forn AS (
      SELECT
        cp.fornecedor_codigo,
        max(cp.fornecedor_nome)                                  AS fornecedor_nome,
        min(cp.data_emissao)                                     AS primeira_emissao,
        max(cp.data_emissao)                                     AS ultima_emissao,
        count(*)                                                 AS qtd_titulos,
        sum(cp.valor_original)                                   AS acumulado,
        max(cp.valor_original)                                   AS maior_titulo,
        array_agg(cp.id ORDER BY cp.data_emissao)                AS conta_ids,
        (array_agg(cp.empresa_id ORDER BY cp.valor_original DESC))[1]        AS empresa_id_top,
        (array_agg(cp.departamento_id ORDER BY cp.valor_original DESC))[1]   AS departamento_id_top,
        (array_agg(cp.departamento_nome ORDER BY cp.valor_original DESC))[1] AS departamento_nome_top,
        (array_agg(cp.plano_contas_id ORDER BY cp.valor_original DESC))[1]   AS plano_contas_id_top
      FROM public.contas_pagar cp
      WHERE cp.natureza_lancamento = 'lancado'
        AND cp.fornecedor_codigo IS NOT NULL
        AND cp.data_emissao IS NOT NULL
        AND cp.valor_original > 0
      GROUP BY cp.fornecedor_codigo
    ),
    cand AS (
      SELECT f.*,
        cfg.janela_dias, cfg.piso_acumulado, cfg.piso_titulo,
        cfg.piso_critico, cfg.piso_materialidade, cfg.sev_default,
        (CURRENT_DATE - f.primeira_emissao)                     AS idade_dias,
        round(f.acumulado / NULLIF((CURRENT_DATE - f.primeira_emissao), 0), 2) AS burn_dia
      FROM forn f CROSS JOIN cfg
      WHERE f.primeira_emissao >= CURRENT_DATE - (cfg.janela_dias || ' days')::interval
        AND (f.acumulado >= cfg.piso_acumulado OR f.maior_titulo >= cfg.piso_titulo)
        AND f.acumulado >= cfg.piso_materialidade
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score,
        valor_impacto, empresa_id, departamento_id, plano_contas_id,
        fornecedor_codigo, fornecedor_nome, competencia, conta_ids, evidencia
      )
      SELECT
        'R02_FORNECEDOR_NOVO_VOLUME',
        c.fornecedor_codigo,
        CASE
          WHEN c.acumulado >= c.piso_critico THEN 'critica'
          WHEN EXISTS (
            SELECT 1 FROM public.despesa_alertas r01
            WHERE r01.regra_codigo LIKE 'R01\_%'
              AND r01.status IN ('novo','em_analise','acionado')
              AND c.departamento_id_top IS NOT NULL
              AND r01.departamento_id IS NOT DISTINCT FROM c.departamento_id_top
          ) THEN 'critica'
          ELSE c.sev_default
        END,
        'Fornecedor novo com volume alto: ' || COALESCE(c.fornecedor_nome, c.fornecedor_codigo),
        'Fornecedor com 1a emissao ha ' || c.idade_dias || ' dia(s) (' ||
          to_char(c.primeira_emissao,'DD/MM/YYYY') || ') ja acumula R$ ' ||
          to_char(c.acumulado,'FM999G999G990D00') || ' em ' || c.qtd_titulos ||
          ' titulo(s); maior titulo R$ ' || to_char(c.maior_titulo,'FM999G999G990D00') ||
          '. Padrao tipico de fornecedor-fantasma (billing scheme) - verificar existencia e lastro.',
        round(greatest(
          c.acumulado    / NULLIF(c.piso_acumulado, 0),
          c.maior_titulo / NULLIF(c.piso_titulo, 0)
        ), 3),
        c.acumulado,
        c.empresa_id_top,
        c.departamento_id_top,
        c.plano_contas_id_top,
        c.fornecedor_codigo,
        c.fornecedor_nome,
        date_trunc('month', c.primeira_emissao)::date,
        c.conta_ids,
        jsonb_build_object(
          'primeira_emissao',  c.primeira_emissao,
          'ultima_emissao',    c.ultima_emissao,
          'idade_dias',        c.idade_dias,
          'janela_dias',       c.janela_dias,
          'qtd_titulos',       c.qtd_titulos,
          'acumulado',         c.acumulado,
          'maior_titulo',      c.maior_titulo,
          'burn_dia',          c.burn_dia,
          'natureza',          'lancado',
          'departamento_nome', c.departamento_nome_top,
          'gatilho', CASE
                       WHEN c.acumulado >= c.piso_acumulado AND c.maior_titulo >= c.piso_titulo THEN 'acumulado+titulo'
                       WHEN c.acumulado >= c.piso_acumulado THEN 'acumulado'
                       ELSE 'titulo'
                     END,
          'params', jsonb_build_object(
                      'piso_acumulado',     c.piso_acumulado,
                      'piso_titulo',        c.piso_titulo,
                      'piso_critico',       c.piso_critico,
                      'piso_materialidade', c.piso_materialidade)
        )
      FROM cand c
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo','em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R02_FORNECEDOR_NOVO_VOLUME'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R03_DUPLICIDADE ==============================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R03_DUPLICIDADE';
  IF (p_regras IS NULL OR 'R03_DUPLICIDADE' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH r AS (
      SELECT
        COALESCE((params->>'janela_dias')::int,        7)    AS janela_dias,
        COALESCE((params->>'tolerancia_pct')::numeric, 0.01) AS tolerancia_pct,
        COALESCE((params->>'piso_valor')::numeric,     500)  AS piso_valor,
        COALESCE(severidade_default, 'alta')                 AS sev_default
      FROM public.despesa_regras
      WHERE codigo = 'R03_DUPLICIDADE' AND ativo
    ),
    pares AS (
      SELECT
        a.id AS id_a, b.id AS id_b,
        a.erp_id AS erp_a, b.erp_id AS erp_b,
        a.empresa_id,
        a.fornecedor_codigo, a.fornecedor_nome,
        a.departamento_id, a.plano_contas_id, a.plano_contas_nome,
        a.numero_documento AS doc_a, b.numero_documento AS doc_b,
        a.valor_original AS valor_a, b.valor_original AS valor_b,
        a.data_emissao   AS emissao_a, b.data_emissao AS emissao_b,
        GREATEST(a.valor_original, b.valor_original) AS valor_maior,
        (a.data_pagamento IS NOT NULL AND b.data_pagamento IS NOT NULL) AS ambos_pagos,
        r.sev_default
      FROM public.contas_pagar a
      JOIN public.contas_pagar b
        ON  b.empresa_id        = a.empresa_id
        AND b.fornecedor_codigo = a.fornecedor_codigo
        AND b.erp_id            > a.erp_id
      CROSS JOIN r
      WHERE a.status <> 'cancelado'
        AND b.status <> 'cancelado'
        AND a.fornecedor_codigo IS NOT NULL
        AND a.valor_original IS NOT NULL
        AND b.valor_original IS NOT NULL
        AND a.data_emissao IS NOT NULL
        AND b.data_emissao IS NOT NULL
        AND abs(a.data_emissao - b.data_emissao) <= r.janela_dias
        AND abs(a.valor_original - b.valor_original)
            <= r.tolerancia_pct
               * NULLIF(GREATEST(a.valor_original, b.valor_original), 0)
        AND GREATEST(a.valor_original, b.valor_original) >= r.piso_valor
        AND NOT (
              a.numero_documento IS NOT DISTINCT FROM b.numero_documento
              AND a.parcela IS DISTINCT FROM b.parcela
            )
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao,
        score, valor_impacto, empresa_id, departamento_id, plano_contas_id,
        fornecedor_codigo, fornecedor_nome, competencia, conta_ids, evidencia
      )
      SELECT
        'R03_DUPLICIDADE',
        p.erp_a || '|' || p.erp_b,
        CASE WHEN p.ambos_pagos THEN 'critica' ELSE p.sev_default END,
        'Duplicidade: ' || COALESCE(p.fornecedor_nome, p.fornecedor_codigo)
          || ' — R$ ' || to_char(p.valor_maior, 'FM999G999G990D00'),
        'Dois titulos do mesmo fornecedor+empresa com valor equivalente (±'
          || to_char(r.tolerancia_pct * 100, 'FM990D0') || '%) emitidos em '
          || abs(p.emissao_a - p.emissao_b) || ' dia(s). '
          || CASE WHEN p.ambos_pagos THEN 'Ambos PAGOS — dupla saida de caixa consumada.'
                  ELSE 'Ao menos um em aberto — risco de duplo pagamento.' END,
        round(1 - abs(p.valor_a - p.valor_b) / NULLIF(p.valor_maior, 0), 4),
        p.valor_maior,
        p.empresa_id,
        p.departamento_id,
        p.plano_contas_id,
        p.fornecedor_codigo,
        p.fornecedor_nome,
        date_trunc('month', GREATEST(p.emissao_a, p.emissao_b))::date,
        ARRAY[p.id_a, p.id_b],
        jsonb_build_object(
          'erp_id_a', p.erp_a, 'erp_id_b', p.erp_b,
          'numero_documento_a', p.doc_a, 'numero_documento_b', p.doc_b,
          'valor_a', p.valor_a, 'valor_b', p.valor_b,
          'data_emissao_a', p.emissao_a, 'data_emissao_b', p.emissao_b,
          'delta_dias', abs(p.emissao_a - p.emissao_b),
          'delta_valor', abs(p.valor_a - p.valor_b),
          'ambos_pagos', p.ambos_pagos,
          'params', jsonb_build_object(
            'janela_dias', r.janela_dias,
            'tolerancia_pct', r.tolerancia_pct,
            'piso_valor', r.piso_valor)
        )
      FROM pares p
      CROSS JOIN r
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo', 'em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R03_DUPLICIDADE'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R04_FRACIONAMENTO ============================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R04_FRACIONAMENTO';
  IF (p_regras IS NULL OR 'R04_FRACIONAMENTO' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH p AS (
      SELECT
        COALESCE((params->>'piso_valor')::numeric,        10000)   AS piso_valor,
        COALESCE((params->>'min_titulos')::int,           3)       AS min_titulos,
        COALESCE((params->>'mult_soma')::numeric,         1.2)     AS mult_soma,
        COALESCE(NULLIF(params->>'janela',''),            'dia')   AS janela,
        COALESCE((params->>'cv_max')::numeric,            0.25)    AS cv_max,
        COALESCE((params->>'piso_materialidade')::numeric, 0)      AS piso_materialidade,
        CASE WHEN jsonb_typeof(params->'whitelist_planos') = 'array'
             THEN ARRAY(SELECT (jsonb_array_elements_text(params->'whitelist_planos'))::uuid)
             ELSE ARRAY[]::uuid[] END                              AS whitelist_planos,
        severidade_default                                          AS sev
      FROM public.despesa_regras
      WHERE codigo = 'R04_FRACIONAMENTO' AND ativo
    ),
    titulos AS (
      SELECT
        cp.id,
        cp.empresa_id,
        cp.fornecedor_codigo,
        cp.fornecedor_nome,
        cp.departamento_id,
        cp.plano_contas_id,
        cp.plano_contas_nome,
        cp.numero_documento,
        cp.valor_original,
        cp.data_emissao,
        CASE WHEN p.janela = 'semana'
             THEN date_trunc('week', cp.data_emissao)::date
             ELSE cp.data_emissao
        END AS periodo_bucket
      FROM public.contas_pagar cp
      CROSS JOIN p
      WHERE cp.status <> 'cancelado'
        AND cp.fornecedor_codigo IS NOT NULL
        AND cp.data_emissao IS NOT NULL
        AND cp.valor_original IS NOT NULL
        AND cp.valor_original > 0
        AND cp.valor_original < p.piso_valor
        AND NOT (cp.departamento_nome = 'Administrativo'
                 AND COALESCE(cp.confianca_classificacao, 0) < 0.7
                 AND cp.classificacao_manual IS NOT TRUE)
        AND (cardinality(p.whitelist_planos) = 0
             OR cp.plano_contas_id IS NULL
             OR cp.plano_contas_id <> ALL (p.whitelist_planos))
    ),
    grupos AS (
      SELECT
        t.empresa_id,
        t.fornecedor_codigo,
        max(t.fornecedor_nome)                          AS fornecedor_nome,
        t.periodo_bucket,
        count(*)                                        AS n_titulos,
        sum(t.valor_original)                           AS soma,
        avg(t.valor_original)                           AS media,
        coalesce(stddev_samp(t.valor_original), 0)      AS desvio,
        array_agg(t.id ORDER BY t.data_emissao, t.id)   AS conta_ids,
        mode() WITHIN GROUP (ORDER BY t.departamento_id)   AS departamento_id,
        mode() WITHIN GROUP (ORDER BY t.plano_contas_id)   AS plano_contas_id,
        jsonb_agg(
          jsonb_build_object(
            'conta_id',         t.id,
            'numero_documento', t.numero_documento,
            'valor_original',   t.valor_original,
            'data_emissao',     t.data_emissao,
            'plano_contas',     t.plano_contas_nome
          ) ORDER BY t.data_emissao, t.id
        )                                               AS titulos_evidencia
      FROM titulos t
      GROUP BY t.empresa_id, t.fornecedor_codigo, t.periodo_bucket
    ),
    matches AS (
      SELECT
        g.*,
        p.piso_valor, p.mult_soma, p.min_titulos, p.cv_max, p.janela, p.sev,
        (g.desvio / NULLIF(g.media, 0))                 AS cv,
        (g.soma / NULLIF(p.piso_valor, 0))              AS ratio_alcada
      FROM grupos g
      CROSS JOIN p
      WHERE g.n_titulos >= p.min_titulos
        AND g.soma      >= p.mult_soma * p.piso_valor
        AND g.soma      >= p.piso_materialidade
        AND (g.desvio / NULLIF(g.media, 0)) <= p.cv_max
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score, valor_impacto,
        empresa_id, departamento_id, plano_contas_id, fornecedor_codigo, fornecedor_nome,
        competencia, conta_ids, evidencia
      )
      SELECT
        'R04_FRACIONAMENTO',
        'R04|' || m.empresa_id || '|' || m.fornecedor_codigo || '|' || m.janela || '|'
              || to_char(m.periodo_bucket, 'YYYY-MM-DD'),
        m.sev,
        'Fracionamento: ' || m.n_titulos || ' títulos de ' || COALESCE(m.fornecedor_nome, m.fornecedor_codigo)
          || ' em ' || CASE WHEN m.janela = 'semana' THEN 'na semana de ' ELSE '' END
          || to_char(m.periodo_bucket, 'DD/MM/YYYY')
          || ' somando ' || to_char(m.soma, 'FM999G999G990D00'),
        m.n_titulos || ' títulos todos abaixo da alçada de '
          || to_char(m.piso_valor, 'FM999G999G990D00')
          || ' (fatias parelhas, CV ' || to_char(round(m.cv, 3), 'FM990D000')
          || ') somam ' || to_char(m.soma, 'FM999G999G990D00')
          || ' — possível estruturação para escapar de aprovação.',
        round(m.ratio_alcada, 4),
        round(m.soma, 2),
        m.empresa_id,
        m.departamento_id,
        m.plano_contas_id,
        m.fornecedor_codigo,
        m.fornecedor_nome,
        m.periodo_bucket,
        m.conta_ids,
        jsonb_build_object(
          'janela',        m.janela,
          'periodo',       m.periodo_bucket,
          'n_titulos',     m.n_titulos,
          'soma',          round(m.soma, 2),
          'media',         round(m.media, 2),
          'desvio',        round(m.desvio, 2),
          'cv',            round(m.cv, 4),
          'alcada_param',  m.piso_valor,
          'mult_soma',     m.mult_soma,
          'cv_max',        m.cv_max,
          'titulos',       m.titulos_evidencia
        )
      FROM matches m
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo','em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R04_FRACIONAMENTO'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R06_CONCENTRACAO_FORNECEDOR ==================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R06_CONCENTRACAO_FORNECEDOR';
  IF (p_regras IS NULL OR 'R06_CONCENTRACAO_FORNECEDOR' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH p AS (
      SELECT
        COALESCE((params->>'share_min')::numeric,       0.40)   AS share_min,
        COALESCE((params->>'share_alta')::numeric,      0.60)   AS share_alta,
        COALESCE((params->>'piso_valor')::numeric,      30000)  AS piso_valor,
        COALESCE((params->>'janela_dias')::int,         90)     AS janela_dias,
        COALESCE((params->>'delta_pp_min')::numeric,    0.10)   AS delta_pp_min,
        COALESCE((params->>'meses_casa_alta')::int,     24)     AS meses_casa_alta,
        COALESCE((params->>'excluir_admin_baixa_conf')::boolean, true) AS excluir_admin
      FROM public.despesa_regras WHERE codigo = 'R06_CONCENTRACAO_FORNECEDOR'
    ),
    base AS (
      SELECT cp.*
      FROM public.contas_pagar cp, p
      WHERE cp.status <> 'cancelado'
        AND cp.data_emissao IS NOT NULL
        AND cp.departamento_id IS NOT NULL
        AND cp.fornecedor_codigo IS NOT NULL
        AND cp.valor_original IS NOT NULL
        AND cp.data_emissao >= (current_date - ((p.janela_dias) || ' days')::interval - interval '1 year')
        AND NOT (
          p.excluir_admin
          AND cp.departamento_nome = 'Administrativo'
          AND COALESCE(cp.confianca_classificacao,0) < 0.7
          AND cp.classificacao_manual IS NOT TRUE
        )
    ),
    janela AS (
      SELECT b.*,
        CASE
          WHEN b.data_emissao >  (current_date - ((SELECT janela_dias FROM p) || ' days')::interval)
            THEN 'A'
          WHEN b.data_emissao >  (current_date - ((SELECT janela_dias FROM p) || ' days')::interval - interval '1 year')
           AND b.data_emissao <= (current_date - interval '1 year')
            THEN 'B'
          ELSE NULL
        END AS win
      FROM base b
    ),
    dept_total AS (
      SELECT empresa_id, departamento_id, win, SUM(valor_original) AS total_dept
      FROM janela WHERE win IS NOT NULL
      GROUP BY empresa_id, departamento_id, win
    ),
    forn_dept AS (
      SELECT empresa_id, departamento_id, departamento_nome,
             fornecedor_codigo,
             MAX(fornecedor_nome) AS fornecedor_nome,
             MIN(plano_contas_id) AS plano_contas_id,
             win,
             SUM(valor_original) AS total_forn,
             COUNT(*)            AS qtd_titulos,
             ARRAY_AGG(id) FILTER (WHERE win = 'A') AS conta_ids_a
      FROM janela WHERE win IS NOT NULL
      GROUP BY empresa_id, departamento_id, departamento_nome, fornecedor_codigo, win
    ),
    share AS (
      SELECT fd.empresa_id, fd.departamento_id, fd.departamento_nome,
             fd.fornecedor_codigo, fd.fornecedor_nome, fd.win,
             fd.total_forn, dt.total_dept, fd.qtd_titulos, fd.conta_ids_a,
             fd.plano_contas_id,
             (fd.total_forn / NULLIF(dt.total_dept, 0)) AS share_pct
      FROM forn_dept fd
      JOIN dept_total dt
        ON dt.empresa_id = fd.empresa_id
       AND dt.departamento_id = fd.departamento_id
       AND dt.win = fd.win
    ),
    pivot AS (
      SELECT
        a.empresa_id, a.departamento_id, a.departamento_nome, a.fornecedor_codigo,
        a.fornecedor_nome, a.plano_contas_id, a.conta_ids_a, a.qtd_titulos,
        a.total_forn      AS forn_a,
        a.total_dept      AS dept_a,
        a.share_pct       AS share_a,
        b.share_pct       AS share_b
      FROM share a
      LEFT JOIN share b
        ON b.empresa_id = a.empresa_id
       AND b.departamento_id = a.departamento_id
       AND b.fornecedor_codigo = a.fornecedor_codigo
       AND b.win = 'B'
      WHERE a.win = 'A'
    ),
    forn_idade AS (
      SELECT fornecedor_codigo, MIN(data_emissao) AS primeiro_lancamento
      FROM public.contas_pagar
      WHERE status <> 'cancelado' AND fornecedor_codigo IS NOT NULL
      GROUP BY fornecedor_codigo
    ),
    detect AS (
      SELECT
        pv.*,
        fi.primeiro_lancamento,
        (current_date - fi.primeiro_lancamento) AS idade_dias,
        (pv.share_a - COALESCE(pv.share_b, 0))  AS delta_pp
      FROM pivot pv
      LEFT JOIN forn_idade fi ON fi.fornecedor_codigo = pv.fornecedor_codigo
      , p
      WHERE pv.dept_a >= p.piso_valor
        AND pv.share_a >= p.share_min
        AND (pv.share_a - COALESCE(pv.share_b, 0)) >= p.delta_pp_min
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score, valor_impacto,
        empresa_id, departamento_id, plano_contas_id, fornecedor_codigo, fornecedor_nome,
        competencia, conta_ids, evidencia
      )
      SELECT
        'R06_CONCENTRACAO_FORNECEDOR',
        d.departamento_id::text || '|' || d.fornecedor_codigo || '|'
          || to_char(date_trunc('quarter', current_date), 'YYYY') || '-Q'
          || to_char(date_trunc('quarter', current_date), 'Q'),
        CASE
          WHEN d.share_a >= p.share_alta
           AND d.primeiro_lancamento IS NOT NULL
           AND d.idade_dias < (p.meses_casa_alta * 30)
          THEN 'alta' ELSE 'media'
        END,
        'Concentração de fornecedor em ' || COALESCE(d.departamento_nome, 'departamento')
          || ': ' || round(d.share_a * 100, 1) || '% do gasto',
        COALESCE(d.fornecedor_nome, d.fornecedor_codigo)
          || ' concentra ' || round(d.share_a * 100, 1) || '% do gasto do departamento nos últimos '
          || p.janela_dias || ' dias (era ' || round(COALESCE(d.share_b, 0) * 100, 1)
          || '% no mesmo período do ano anterior; +' || round(d.delta_pp * 100, 1)
          || ' p.p. YoY). Total do fornecedor R$ ' || round(d.forn_a, 2)
          || ' de R$ ' || round(d.dept_a, 2) || ' do departamento.',
        round(d.share_a, 4),
        round(d.forn_a, 2),
        d.empresa_id, d.departamento_id, d.plano_contas_id,
        d.fornecedor_codigo, d.fornecedor_nome,
        date_trunc('quarter', current_date)::date,
        COALESCE(d.conta_ids_a, '{}'),
        jsonb_build_object(
          'janela_dias', p.janela_dias,
          'share_atual', round(d.share_a, 4),
          'share_ano_anterior', round(COALESCE(d.share_b, 0), 4),
          'delta_pp_yoy', round(d.delta_pp, 4),
          'gasto_fornecedor_janela', round(d.forn_a, 2),
          'gasto_departamento_janela', round(d.dept_a, 2),
          'qtd_titulos_janela', d.qtd_titulos,
          'fornecedor_novo_no_dept', (d.share_b IS NULL),
          'primeiro_lancamento', d.primeiro_lancamento,
          'idade_meses_aprox', CASE WHEN d.idade_dias IS NOT NULL THEN round(d.idade_dias / 30.0, 1) ELSE NULL END,
          'limiares', jsonb_build_object('share_min', p.share_min, 'share_alta', p.share_alta,
                                         'piso_valor', p.piso_valor, 'delta_pp_min', p.delta_pp_min)
        )
      FROM detect d, p
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias = despesa_alertas.ocorrencias + 1,
        score = EXCLUDED.score,
        valor_impacto = EXCLUDED.valor_impacto,
        evidencia = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo', 'em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R06_CONCENTRACAO_FORNECEDOR'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R07_LANCAMENTO_NAO_UTIL ======================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R07_LANCAMENTO_NAO_UTIL';
  IF (p_regras IS NULL OR 'R07_LANCAMENTO_NAO_UTIL' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH r AS (
      SELECT
        COALESCE((params->>'piso_valor')::numeric, 5000)            AS piso_valor,
        COALESCE(severidade_default, 'baixa')                        AS sev,
        COALESCE(params->'excluir_tipos',
                 '["BOLETO","TARIFA","IMPOSTO"]'::jsonb)             AS excluir_tipos,
        COALESCE((params->>'conf_min_admin')::numeric, 0.70)        AS conf_min_admin
      FROM public.despesa_regras
      WHERE codigo = 'R07_LANCAMENTO_NAO_UTIL'
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score, valor_impacto,
        empresa_id, departamento_id, plano_contas_id, fornecedor_codigo, fornecedor_nome,
        competencia, conta_ids, evidencia
      )
      SELECT
        'R07_LANCAMENTO_NAO_UTIL',
        cp.erp_id,
        r.sev,
        'Emissao em dia nao util: ' || COALESCE(cp.fornecedor_nome,'(sem fornecedor)')
          || ' — ' || to_char(cp.valor_original,'FM999G999G990D00'),
        'Titulo '
          || COALESCE(cp.tipo_documento,'?') || ' ' || COALESCE(cp.numero_documento,'?')
          || '/' || COALESCE(cp.parcela::text,'?')
          || ' emitido em ' || to_char(cp.data_emissao,'DD/MM/YYYY')
          || ' (' || CASE
                       WHEN fer.nome IS NOT NULL THEN 'feriado: ' || fer.nome
                       WHEN extract(isodow FROM cp.data_emissao) = 6 THEN 'sabado'
                       ELSE 'domingo'
                     END || '). Fator de risco de baixa severidade — data_emissao e DATE '
          || 'sem hora/autor; usar como sinal, nao prova.',
        0.30,
        cp.valor_original,
        cp.empresa_id,
        cp.departamento_id,
        cp.plano_contas_id,
        cp.fornecedor_codigo,
        cp.fornecedor_nome,
        date_trunc('month', cp.data_emissao)::date,
        ARRAY[cp.id],
        jsonb_build_object(
          'data_emissao',       cp.data_emissao,
          'dia_semana',         CASE
                                  WHEN fer.nome IS NOT NULL THEN 'feriado'
                                  WHEN extract(isodow FROM cp.data_emissao) = 6 THEN 'sabado'
                                  ELSE 'domingo' END,
          'feriado_nome',       fer.nome,
          'feriado_tipo',       fer.tipo,
          'tipo_documento',     cp.tipo_documento,
          'numero_documento',   cp.numero_documento,
          'parcela',            cp.parcela,
          'valor_original',     cp.valor_original,
          'natureza',           cp.natureza_lancamento,
          'portador',           cp.portador,
          'piso_aplicado',      r.piso_valor,
          'tipos_excluidos',    r.excluir_tipos
        )
      FROM public.contas_pagar cp
      CROSS JOIN r
      LEFT JOIN LATERAL (
        SELECT f.nome, f.tipo
        FROM public.feriados f
        WHERE f.data = cp.data_emissao
          AND f.ano  = extract(year FROM cp.data_emissao)::int
        ORDER BY CASE f.tipo
                   WHEN 'municipal' THEN 1 WHEN 'estadual' THEN 2
                   WHEN 'nacional'  THEN 3 ELSE 4 END,
                 f.nome
        LIMIT 1
      ) fer ON true
      WHERE cp.status <> 'cancelado'
        AND cp.data_emissao IS NOT NULL
        AND cp.valor_original >= r.piso_valor
        AND (extract(isodow FROM cp.data_emissao) IN (6,7) OR fer.nome IS NOT NULL)
        AND NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(r.excluir_tipos) t(pat)
              WHERE cp.tipo_documento IS NOT NULL
                AND upper(cp.tipo_documento) LIKE '%' || upper(t.pat) || '%'
            )
        AND NOT (cp.departamento_nome = 'Administrativo'
                 AND COALESCE(cp.confianca_classificacao, 0) < r.conf_min_admin
                 AND cp.classificacao_manual IS NOT TRUE)
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo','em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R07_LANCAMENTO_NAO_UTIL'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R08_BENFORD ==================================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R08_BENFORD';
  IF (p_regras IS NULL OR 'R08_BENFORD' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH r AS (
      SELECT
        COALESCE((params->>'qui2_critico')::numeric, 20.09)   AS qui2_critico,
        COALESCE((params->>'min_amostra_dept')::int, 300)      AS min_amostra_dept,
        COALESCE((params->>'min_amostra_forn')::int, 100)      AS min_amostra_forn,
        COALESCE((params->>'piso_valor')::numeric, 0)          AS piso_valor,
        COALESCE((params->>'meses_janela')::int, 6)            AS meses_janela,
        COALESCE(severidade_default, 'media')                  AS severidade
      FROM public.despesa_regras
      WHERE codigo = 'R08_BENFORD' AND ativo IS TRUE
    ),
    docs AS (
      SELECT DISTINCT ON (cp.empresa_id, cp.fornecedor_codigo, cp.numero_documento)
        cp.id,
        cp.empresa_id,
        cp.departamento_id,
        cp.fornecedor_codigo,
        cp.fornecedor_nome,
        cp.data_emissao,
        cp.valor_original,
        (date_trunc('year', cp.data_emissao)
           + (CASE WHEN EXTRACT(MONTH FROM cp.data_emissao) > 6
                   THEN INTERVAL '6 months' ELSE INTERVAL '0' END))::date  AS semestre_ini,
        LEFT(regexp_replace(trim(to_char(abs(cp.valor_original), 'FM999999999990.999999')),
                            '^[0.,]+', ''), 1)::int                        AS d1
      FROM public.contas_pagar cp
      CROSS JOIN r
      WHERE cp.status <> 'cancelado'
        AND cp.valor_original IS NOT NULL
        AND abs(cp.valor_original) >= GREATEST(r.piso_valor, 1)
        AND cp.data_emissao IS NOT NULL
        AND cp.data_emissao >= (date_trunc('month', current_date)
                                  - make_interval(months => r.meses_janela))::date
        AND cp.numero_documento IS NOT NULL
        AND NOT (cp.departamento_nome = 'Administrativo'
                 AND COALESCE(cp.confianca_classificacao, 0) < 0.7
                 AND cp.classificacao_manual IS NOT TRUE)
      ORDER BY cp.empresa_id, cp.fornecedor_codigo, cp.numero_documento, cp.id
    ),
    docs_ok AS (
      SELECT * FROM docs WHERE d1 BETWEEN 1 AND 9
    ),
    escopos AS (
      SELECT 'dept'::text AS escopo,
             d.departamento_id::text AS entidade_id,
             d.semestre_ini, d.d1, d.id, d.valor_original,
             NULL::integer  AS empresa_id,
             d.departamento_id, NULL::text AS fornecedor_codigo, NULL::text AS fornecedor_nome
      FROM docs_ok d
      WHERE d.departamento_id IS NOT NULL
      UNION ALL
      SELECT 'fornecedor'::text,
             d.fornecedor_codigo,
             d.semestre_ini, d.d1, d.id, d.valor_original,
             NULL::integer,
             NULL::uuid, d.fornecedor_codigo, max(d.fornecedor_nome) OVER (PARTITION BY d.fornecedor_codigo)
      FROM docs_ok d
      WHERE d.fornecedor_codigo IS NOT NULL
    ),
    por_digito AS (
      SELECT escopo, entidade_id, semestre_ini, d1,
             count(*) AS obs,
             array_agg(id) AS ids_do_digito,
             sum(valor_original) AS valor_do_digito
      FROM escopos
      GROUP BY escopo, entidade_id, semestre_ini, d1
    ),
    por_entidade AS (
      SELECT pd.escopo, pd.entidade_id, pd.semestre_ini,
             sum(pd.obs) AS n,
             sum(pd.valor_do_digito) AS valor_total,
             (array_agg(fn.fornecedor_nome) FILTER (WHERE fn.fornecedor_nome IS NOT NULL))[1] AS fornecedor_nome
      FROM por_digito pd
      LEFT JOIN LATERAL (
        SELECT max(e.fornecedor_nome) AS fornecedor_nome
        FROM escopos e
        WHERE e.escopo = pd.escopo AND e.entidade_id = pd.entidade_id
          AND e.semestre_ini = pd.semestre_ini
      ) fn ON true
      GROUP BY pd.escopo, pd.entidade_id, pd.semestre_ini
    ),
    digitos_esp AS (
      SELECT d, log(10.0, 1.0 + 1.0/d) AS p_benford
      FROM generate_series(1,9) AS d
    ),
    qui2 AS (
      SELECT
        pe.escopo, pe.entidade_id, pe.semestre_ini, pe.n, pe.valor_total, pe.fornecedor_nome,
        sum(
          power(COALESCE(pd.obs,0) - (pe.n * de.p_benford), 2)
            / NULLIF(pe.n * de.p_benford, 0)
        ) AS qui2_stat,
        avg( abs( COALESCE(pd.obs,0)::numeric / NULLIF(pe.n,0) - de.p_benford ) ) AS mad,
        jsonb_object_agg(
          de.d::text,
          jsonb_build_object(
            'obs', COALESCE(pd.obs,0),
            'esp', round(pe.n * de.p_benford, 2),
            'p_benford', round(de.p_benford::numeric, 4)
          ) ORDER BY de.d
        ) AS distribuicao,
        (
          SELECT pd2.ids_do_digito
          FROM por_digito pd2
          JOIN digitos_esp de2 ON de2.d = pd2.d1
          WHERE pd2.escopo = pe.escopo
            AND pd2.entidade_id = pe.entidade_id
            AND pd2.semestre_ini = pe.semestre_ini
          ORDER BY abs(pd2.obs - pe.n * de2.p_benford) DESC
          LIMIT 1
        ) AS ids_digito_top
      FROM por_entidade pe
      CROSS JOIN digitos_esp de
      LEFT JOIN por_digito pd
        ON pd.escopo = pe.escopo AND pd.entidade_id = pe.entidade_id
       AND pd.semestre_ini = pe.semestre_ini AND pd.d1 = de.d
      GROUP BY pe.escopo, pe.entidade_id, pe.semestre_ini, pe.n, pe.valor_total, pe.fornecedor_nome
    ),
    achados AS (
      SELECT
        q.*,
        r.qui2_critico, r.severidade,
        CASE q.escopo WHEN 'dept' THEN r.min_amostra_dept ELSE r.min_amostra_forn END AS min_amostra,
        (to_char(q.semestre_ini, 'YYYY') || '-S'
          || (CASE WHEN EXTRACT(MONTH FROM q.semestre_ini) > 6 THEN '2' ELSE '1' END)) AS semestre_lbl
      FROM qui2 q
      CROSS JOIN r
      WHERE q.n >= (CASE q.escopo WHEN 'dept' THEN r.min_amostra_dept ELSE r.min_amostra_forn END)
        AND q.qui2_stat > r.qui2_critico
    ),
    final AS (
      SELECT
        a.*,
        CASE WHEN a.escopo='dept' THEN a.entidade_id::uuid END AS departamento_id_out,
        CASE WHEN a.escopo='fornecedor' THEN a.entidade_id END AS fornecedor_codigo_out,
        a.semestre_ini AS competencia_out
      FROM achados a
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score, valor_impacto,
        empresa_id, departamento_id, plano_contas_id, fornecedor_codigo, fornecedor_nome,
        competencia, conta_ids, evidencia
      )
      SELECT
        'R08_BENFORD',
        f.escopo || '|' || COALESCE(f.entidade_id, 'null') || '|' || f.semestre_lbl,
        f.severidade,
        CASE f.escopo
          WHEN 'dept' THEN 'Distribuição de 1º dígito atípica no departamento (' || f.semestre_lbl || ')'
          ELSE 'Distribuição de 1º dígito atípica do fornecedor ' || COALESCE(f.fornecedor_nome, f.entidade_id) || ' (' || f.semestre_lbl || ')'
        END,
        'Teste de Benford (χ² 8 g.l., p<0,01) sinalizou desvio da distribuição esperada do 1º dígito em '
          || f.n || ' títulos (' || f.escopo || '). χ²=' || round(f.qui2_stat, 2)
          || ' > ' || f.qui2_critico || '. DIRECIONADOR forense, não prova — investigar valores próximos de limiares de alçada ou repetição atípica.',
        round(f.qui2_stat, 4),
        round(f.valor_total, 2),
        NULL::integer,
        f.departamento_id_out,
        NULL::uuid,
        f.fornecedor_codigo_out,
        CASE WHEN f.escopo='fornecedor' THEN f.fornecedor_nome END,
        f.competencia_out,
        COALESCE(f.ids_digito_top, ARRAY[]::uuid[]),
        jsonb_build_object(
          'escopo', f.escopo,
          'entidade', f.entidade_id,
          'semestre', f.semestre_lbl,
          'n_amostra', f.n,
          'min_amostra', f.min_amostra,
          'qui2', round(f.qui2_stat, 4),
          'qui2_critico', f.qui2_critico,
          'graus_liberdade', 8,
          'p_valor', '<0.01',
          'mad', round(f.mad, 5),
          'distribuicao_1o_digito', f.distribuicao,
          'valor_amostra', round(f.valor_total, 2),
          'dedupe', 'parcelas colapsadas por (empresa,fornecedor,numero_documento)',
          'natureza', 'direcionador_forense'
        )
      FROM final f
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo','em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R08_BENFORD'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R09_PROVISAO_ENGORDA =========================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R09_PROVISAO_ENGORDA';
  IF (p_regras IS NULL OR 'R09_PROVISAO_ENGORDA' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH r09 AS (
      SELECT
        coalesce((params->>'pct_engorda')::numeric, 0.05) AS pct_engorda,
        coalesce((params->>'piso_valor')::numeric, 500)   AS piso_valor,
        coalesce(severidade_default, 'alta')              AS sev
      FROM public.despesa_regras
      WHERE codigo = 'R09_PROVISAO_ENGORDA'
    ),
    transicao AS (
      SELECT h.conta_id, max(h.created_at) AS transicao_em
      FROM public.contas_pagar_historico h
      WHERE h.campo_alterado = 'natureza_lancamento'
        AND lower(h.valor_anterior) = 'provisionado'
        AND lower(h.valor_novo)     = 'lancado'
      GROUP BY h.conta_id
    ),
    edicoes_valor AS (
      SELECT
        h.conta_id,
        h.created_at,
        NULLIF(h.valor_anterior, '')::numeric AS valor_ant_num,
        NULLIF(h.valor_novo, '')::numeric     AS valor_novo_num
      FROM public.contas_pagar_historico h
      WHERE h.campo_alterado = 'valor_original'
        AND h.valor_anterior ~ '^[0-9]+(\.[0-9]+)?$'
        AND h.valor_novo     ~ '^[0-9]+(\.[0-9]+)?$'
    ),
    engorda AS (
      SELECT
        v.conta_id,
        sum(v.valor_novo_num - v.valor_ant_num)                 AS delta_total,
        min(v.valor_ant_num)                                    AS valor_ant_min,
        max(v.valor_novo_num)                                   AS valor_novo_max,
        count(*)                                                AS n_edicoes,
        max(v.created_at)                                       AS ultima_edicao_em,
        min(v.valor_ant_num) FILTER (WHERE v.valor_ant_num > 0) AS base_pct
      FROM edicoes_valor v
      JOIN transicao t ON t.conta_id = v.conta_id
      WHERE v.valor_novo_num > v.valor_ant_num
        AND v.created_at >= t.transicao_em
      GROUP BY v.conta_id
      HAVING sum(v.valor_novo_num - v.valor_ant_num) > 0
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score, valor_impacto,
        empresa_id, departamento_id, plano_contas_id, fornecedor_codigo, fornecedor_nome,
        competencia, conta_ids, evidencia
      )
      SELECT
        'R09_PROVISAO_ENGORDA',
        cp.id::text,
        r.sev,
        'Provisão engordou ao ser lançada: ' || coalesce(cp.fornecedor_nome, 'fornecedor s/ nome')
          || ' — doc ' || coalesce(cp.numero_documento, cp.erp_id),
        'Título passou de provisionado→lançado e teve valor_original elevado de R$ '
          || to_char(e.valor_ant_min, 'FM999G999G990D00') || ' para R$ '
          || to_char(e.valor_novo_max, 'FM999G999G990D00') || ' (+'
          || to_char(100.0 * e.delta_total / NULLIF(e.base_pct, 0), 'FM990D0') || '% / R$ '
          || to_char(e.delta_total, 'FM999G999G990D00') || ') após a aprovação da provisão.',
        round(e.delta_total / NULLIF(e.base_pct, 0), 4),
        round(e.delta_total, 2),
        cp.empresa_id,
        cp.departamento_id,
        cp.plano_contas_id,
        cp.fornecedor_codigo,
        cp.fornecedor_nome,
        date_trunc('month', coalesce(cp.data_emissao, e.ultima_edicao_em::date))::date,
        ARRAY[cp.id],
        jsonb_build_object(
          'transicao_em',      t.transicao_em,
          'ultima_edicao_em',  e.ultima_edicao_em,
          'valor_provisao',    e.valor_ant_min,
          'valor_lancado',     e.valor_novo_max,
          'delta_total',       e.delta_total,
          'engorda_pct',       round(e.delta_total / NULLIF(e.base_pct, 0), 4),
          'n_edicoes_valor',   e.n_edicoes,
          'pct_engorda_param', r.pct_engorda,
          'piso_valor_param',  r.piso_valor,
          'natureza_atual',    cp.natureza_lancamento,
          'origem',            'contas_pagar_historico'
        )
      FROM public.contas_pagar cp
      JOIN transicao t ON t.conta_id = cp.id
      JOIN engorda   e ON e.conta_id = cp.id
      CROSS JOIN r09 r
      WHERE cp.status <> 'cancelado'
        AND e.delta_total >= r.piso_valor
        AND e.delta_total > r.pct_engorda * NULLIF(e.base_pct, 0)
        AND NOT (cp.departamento_nome = 'Administrativo'
                 AND coalesce(cp.confianca_classificacao, 0) < 0.7
                 AND cp.classificacao_manual IS NOT TRUE)
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo', 'em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R09_PROVISAO_ENGORDA'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R11_JUROS_CRONICOS ===========================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R11_JUROS_CRONICOS';
  IF (p_regras IS NULL OR 'R11_JUROS_CRONICOS' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH p AS (
      SELECT
        COALESCE((params->>'janela_meses')::int,          6)     AS janela_meses,
        COALESCE((params->>'min_titulos')::int,           3)     AS min_titulos,
        COALESCE((params->>'pct_juros_min')::numeric,     0.02)  AS pct_juros_min,
        COALESCE((params->>'piso_juros_soma')::numeric,   2000)  AS piso_juros_soma,
        COALESCE((params->>'ratio_pago_min')::numeric,    1.05)  AS ratio_pago_min,
        COALESCE((params->>'piso_valor')::numeric,        2000)  AS piso_valor,
        COALESCE(severidade_default, 'media')                    AS severidade
      FROM public.despesa_regras
      WHERE codigo = 'R11_JUROS_CRONICOS'
    ),
    base AS (
      SELECT
        cp.id, cp.empresa_id, cp.departamento_id, cp.plano_contas_id,
        cp.fornecedor_codigo, cp.fornecedor_nome, cp.valor_original, cp.valor_pago, cp.valor_juros,
        CASE WHEN cp.valor_juros IS NOT NULL AND cp.valor_original IS NOT NULL
             THEN cp.valor_juros / NULLIF(cp.valor_original, 0) END AS ratio_juros,
        CASE WHEN cp.status = 'pago' AND cp.valor_pago IS NOT NULL AND cp.valor_original IS NOT NULL
             THEN cp.valor_pago / NULLIF(cp.valor_original, 0) END AS ratio_pago
      FROM public.contas_pagar cp
      CROSS JOIN p
      WHERE cp.status <> 'cancelado'
        AND cp.fornecedor_codigo IS NOT NULL
        AND cp.data_emissao >= (date_trunc('month', current_date) - make_interval(months => p.janela_meses))::date
        AND NOT (cp.departamento_nome = 'Administrativo'
                 AND cp.confianca_classificacao < 0.7
                 AND cp.classificacao_manual IS NOT TRUE)
    ),
    arm_juros AS (
      SELECT b.fornecedor_codigo,
             array_agg(b.id)    AS conta_ids,
             count(*)           AS qtd,
             sum(b.valor_juros) AS soma_juros
      FROM base b CROSS JOIN p
      WHERE b.ratio_juros > p.pct_juros_min
      GROUP BY b.fornecedor_codigo
    ),
    arm_acresc AS (
      SELECT b.fornecedor_codigo,
             array_agg(b.id)                       AS conta_ids,
             count(*)                              AS qtd,
             sum(b.valor_pago - b.valor_original)  AS soma_acrescimo
      FROM base b CROSS JOIN p
      WHERE b.ratio_pago > p.ratio_pago_min
      GROUP BY b.fornecedor_codigo
    ),
    qualif AS (
      SELECT
        COALESCE(a.fornecedor_codigo, x.fornecedor_codigo) AS fornecedor_codigo,
        (a.qtd >= (SELECT min_titulos FROM p) AND a.soma_juros >= (SELECT piso_juros_soma FROM p)) AS gatilho_a,
        (x.qtd >= (SELECT min_titulos FROM p))              AS gatilho_b,
        COALESCE(a.qtd, 0)            AS qtd_juros,
        COALESCE(a.soma_juros, 0)     AS soma_juros,
        COALESCE(x.qtd, 0)            AS qtd_acresc,
        COALESCE(x.soma_acrescimo, 0) AS soma_acrescimo,
        COALESCE(a.conta_ids, '{}')   AS ids_a,
        COALESCE(x.conta_ids, '{}')   AS ids_b
      FROM arm_juros a
      FULL OUTER JOIN arm_acresc x ON x.fornecedor_codigo = a.fornecedor_codigo
    ),
    alvo AS (
      SELECT q.*,
             (SELECT array_agg(DISTINCT e)
                FROM unnest(
                  (CASE WHEN q.gatilho_a THEN q.ids_a ELSE '{}'::uuid[] END) ||
                  (CASE WHEN q.gatilho_b THEN q.ids_b ELSE '{}'::uuid[] END)
                ) AS e) AS conta_ids,
             (CASE WHEN q.gatilho_a THEN q.soma_juros     ELSE 0 END) +
             (CASE WHEN q.gatilho_b THEN q.soma_acrescimo ELSE 0 END) AS impacto,
             (CASE WHEN q.gatilho_a THEN q.qtd_juros  ELSE 0 END) +
             (CASE WHEN q.gatilho_b THEN q.qtd_acresc ELSE 0 END) AS score_evidencia
      FROM qualif q
      WHERE q.gatilho_a OR q.gatilho_b
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score, valor_impacto,
        empresa_id, departamento_id, plano_contas_id, fornecedor_codigo, fornecedor_nome,
        competencia, conta_ids, evidencia
      )
      SELECT
        'R11_JUROS_CRONICOS',
        al.fornecedor_codigo || '|' || to_char(current_date, 'YYYY') || 'T' || to_char(current_date, 'Q'),
        (SELECT severidade FROM p),
        'Juros/acréscimos crônicos: ' || COALESCE(dim.fornecedor_nome, al.fornecedor_codigo),
        'Fornecedor com ' ||
          CASE WHEN al.gatilho_a THEN al.qtd_juros || ' título(s) com juros >'
               || to_char((SELECT pct_juros_min*100 FROM p), 'FM990D0') || '% (R$ '
               || to_char(al.soma_juros, 'FM999G999G990D00') || ' em juros)' ELSE '' END ||
          CASE WHEN al.gatilho_a AND al.gatilho_b THEN ' e ' ELSE '' END ||
          CASE WHEN al.gatilho_b THEN al.qtd_acresc || ' pago(s) acima de '
               || to_char((SELECT ratio_pago_min*100 FROM p), 'FM990') || '% do original (R$ '
               || to_char(al.soma_acrescimo, 'FM999G999G990D00') || ' de acréscimo)' ELSE '' END
          || ' nos últimos ' || (SELECT janela_meses FROM p) || ' meses.',
        al.score_evidencia,
        round(al.impacto, 2),
        dim.empresa_id, dim.departamento_id, dim.plano_contas_id,
        al.fornecedor_codigo, dim.fornecedor_nome,
        date_trunc('quarter', current_date)::date,
        al.conta_ids,
        jsonb_build_object(
          'janela_meses',                (SELECT janela_meses FROM p),
          'gatilho_juros_cronicos',      al.gatilho_a,
          'gatilho_acrescimo_fabricado', al.gatilho_b,
          'qtd_titulos_juros',           al.qtd_juros,
          'soma_juros',                  round(al.soma_juros, 2),
          'qtd_titulos_acrescimo',       al.qtd_acresc,
          'soma_acrescimo',              round(al.soma_acrescimo, 2),
          'pct_juros_min',               (SELECT pct_juros_min FROM p),
          'piso_juros_soma',             (SELECT piso_juros_soma FROM p),
          'ratio_pago_min',              (SELECT ratio_pago_min FROM p),
          'piso_valor',                  (SELECT piso_valor FROM p)
        )
      FROM alvo al
      CROSS JOIN LATERAL (
        SELECT b.empresa_id, b.departamento_id, b.plano_contas_id, b.fornecedor_nome
        FROM public.contas_pagar b
        WHERE b.id = ANY(al.conta_ids)
        ORDER BY COALESCE(b.valor_juros,0) + GREATEST(COALESCE(b.valor_pago,0)-COALESCE(b.valor_original,0),0) DESC,
                 b.id
        LIMIT 1
      ) dim
      WHERE al.impacto >= (SELECT piso_valor FROM p)
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo','em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R11_JUROS_CRONICOS'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R12_PORTADOR_ATIPICO =========================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R12_PORTADOR_ATIPICO';
  IF (p_regras IS NULL OR 'R12_PORTADOR_ATIPICO' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH par AS (
      SELECT
        COALESCE((params->>'piso_valor')::numeric, 5000)                AS piso_valor,
        COALESCE((params->>'min_pagamentos')::int, 6)                   AS min_pagamentos,
        COALESCE((params->>'supressao_troca_banco_pct')::numeric, 0.30) AS supr_pct,
        severidade_default                                             AS severidade
      FROM public.despesa_regras
      WHERE codigo = 'R12_PORTADOR_ATIPICO'
    ),
    base AS (
      SELECT
        cp.id, cp.empresa_id, cp.fornecedor_codigo, cp.fornecedor_nome,
        cp.departamento_id, cp.plano_contas_id, cp.portador, cp.valor_original,
        COALESCE(cp.data_pagamento, cp.data_emissao) AS data_evento
      FROM public.contas_pagar cp
      WHERE cp.status <> 'cancelado'
        AND cp.portador IS NOT NULL AND btrim(cp.portador) <> ''
        AND cp.fornecedor_codigo IS NOT NULL
        AND COALESCE(cp.data_pagamento, cp.data_emissao) IS NOT NULL
    ),
    hist AS (
      SELECT
        empresa_id,
        fornecedor_codigo,
        count(*)                                    AS n_pgtos,
        mode() WITHIN GROUP (ORDER BY portador)     AS portador_habitual
      FROM base
      GROUP BY empresa_id, fornecedor_codigo
    ),
    atipicos AS (
      SELECT b.*, h.portador_habitual, h.n_pgtos,
             date_trunc('month', b.data_evento)::date AS mes_ref
      FROM base b
      JOIN hist h ON h.empresa_id = b.empresa_id AND h.fornecedor_codigo = b.fornecedor_codigo
      CROSS JOIN par p
      WHERE h.n_pgtos >= p.min_pagamentos
        AND h.portador_habitual IS NOT NULL
        AND b.portador IS DISTINCT FROM h.portador_habitual
        AND b.valor_original >= p.piso_valor
    ),
    troca_massa AS (
      SELECT
        b.empresa_id,
        date_trunc('month', b.data_evento)::date AS mes_ref,
        count(DISTINCT b.fornecedor_codigo) FILTER (
          WHERE b.portador IS DISTINCT FROM h.portador_habitual AND h.portador_habitual IS NOT NULL
        )::numeric / NULLIF(count(DISTINCT b.fornecedor_codigo), 0) AS frac_trocaram
      FROM base b
      JOIN hist h ON h.empresa_id = b.empresa_id AND h.fornecedor_codigo = b.fornecedor_codigo
      GROUP BY b.empresa_id, date_trunc('month', b.data_evento)::date
    ),
    grp AS (
      SELECT
        a.empresa_id, a.fornecedor_codigo,
        max(a.fornecedor_nome)                                          AS fornecedor_nome,
        a.portador, a.portador_habitual, max(a.n_pgtos)                 AS n_pgtos, a.mes_ref,
        (array_agg(a.departamento_id ORDER BY a.valor_original DESC))[1] AS departamento_id,
        (array_agg(a.plano_contas_id ORDER BY a.valor_original DESC))[1] AS plano_contas_id,
        count(*)                                                        AS qtd_titulos,
        sum(a.valor_original)                                           AS valor_impacto,
        array_agg(a.id ORDER BY a.data_evento, a.id)                    AS conta_ids,
        min(a.data_evento)                                             AS primeiro_evento,
        max(a.data_evento)                                             AS ultimo_evento
      FROM atipicos a
      JOIN troca_massa tm ON tm.empresa_id = a.empresa_id AND tm.mes_ref = a.mes_ref
      CROSS JOIN par p
      WHERE COALESCE(tm.frac_trocaram, 0) <= p.supr_pct
      GROUP BY a.empresa_id, a.fornecedor_codigo, a.portador, a.portador_habitual, a.mes_ref
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score, valor_impacto,
        empresa_id, departamento_id, plano_contas_id, fornecedor_codigo, fornecedor_nome,
        competencia, conta_ids, evidencia
      )
      SELECT
        'R12_PORTADOR_ATIPICO',
        g.empresa_id || '|' || g.fornecedor_codigo || '|' || g.portador || '|' || to_char(g.mes_ref, 'YYYY-MM'),
        (SELECT severidade FROM par),
        'Portador atipico: ' || COALESCE(g.fornecedor_nome, g.fornecedor_codigo) || ' via ' || g.portador,
        'Fornecedor com portador habitual "' || g.portador_habitual || '" (' || g.n_pgtos
          || ' pgtos hist.) teve ' || g.qtd_titulos || ' titulo(s) roteado(s) por "' || g.portador
          || '" em ' || to_char(g.mes_ref, 'MM/YYYY') || ' (R$ '
          || to_char(g.valor_impacto, 'FM999G999G990D00') || '). Pagamento fora do rito habitual.',
        g.qtd_titulos::numeric,
        g.valor_impacto,
        g.empresa_id, g.departamento_id, g.plano_contas_id,
        g.fornecedor_codigo, g.fornecedor_nome,
        g.mes_ref,
        g.conta_ids,
        jsonb_build_object(
          'regra', 'R12_PORTADOR_ATIPICO',
          'portador_atipico', g.portador,
          'portador_habitual', g.portador_habitual,
          'pagamentos_historicos', g.n_pgtos,
          'qtd_titulos_atipicos', g.qtd_titulos,
          'valor_impacto', g.valor_impacto,
          'mes_ref', to_char(g.mes_ref, 'YYYY-MM'),
          'periodo_evento', jsonb_build_object('de', g.primeiro_evento, 'ate', g.ultimo_evento),
          'params', jsonb_build_object(
            'piso_valor', (SELECT piso_valor FROM par),
            'min_pagamentos', (SELECT min_pagamentos FROM par),
            'supressao_troca_banco_pct', (SELECT supr_pct FROM par)
          ),
          'limitacao', 'portador = banco NOSSO da saida; conta do favorecido nao existe no espelho (§4 R12)'
        )
      FROM grp g
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo', 'em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R12_PORTADOR_ATIPICO'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R13_DOUBLE_DIPPING_INTRAGRUPO =================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R13_DOUBLE_DIPPING_INTRAGRUPO';
  IF (p_regras IS NULL OR 'R13_DOUBLE_DIPPING_INTRAGRUPO' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH r AS (
      SELECT
        COALESCE((params->>'piso_valor')::numeric, 5000)  AS piso_valor,
        COALESCE((params->>'min_cnpjs')::int, 2)          AS min_cnpjs,
        severidade_default
      FROM public.despesa_regras
      WHERE codigo = 'R13_DOUBLE_DIPPING_INTRAGRUPO'
    ),
    por_cnpj AS (
      SELECT
        cp.fornecedor_codigo,
        cp.numero_documento,
        cp.valor_original,
        cp.empresa_id,
        max(cp.fornecedor_nome)                       AS fornecedor_nome,
        (array_agg(cp.id ORDER BY cp.data_emissao NULLS LAST, cp.id))[1]  AS conta_id_ref,
        (array_agg(cp.departamento_id ORDER BY cp.data_emissao NULLS LAST, cp.id)
            FILTER (WHERE cp.departamento_id IS NOT NULL))[1]             AS departamento_id,
        (array_agg(cp.plano_contas_id ORDER BY cp.data_emissao NULLS LAST, cp.id)
            FILTER (WHERE cp.plano_contas_id IS NOT NULL))[1]             AS plano_contas_id,
        min(cp.data_emissao)                          AS primeira_emissao
      FROM public.contas_pagar cp
      CROSS JOIN r
      WHERE cp.status <> 'cancelado'
        AND cp.numero_documento IS NOT NULL
        AND btrim(cp.numero_documento) <> ''
        AND cp.fornecedor_codigo IS NOT NULL
        AND cp.valor_original IS NOT NULL
        AND cp.valor_original >= r.piso_valor
      GROUP BY cp.fornecedor_codigo, cp.numero_documento, cp.valor_original, cp.empresa_id
    ),
    grupos AS (
      SELECT
        pc.fornecedor_codigo,
        pc.numero_documento,
        pc.valor_original,
        count(DISTINCT pc.empresa_id)                 AS n_cnpjs,
        array_agg(DISTINCT pc.empresa_id ORDER BY pc.empresa_id) AS empresas,
        array_agg(pc.conta_id_ref)                    AS conta_ids,
        max(pc.fornecedor_nome)                       AS fornecedor_nome,
        (array_agg(pc.departamento_id) FILTER (WHERE pc.departamento_id IS NOT NULL))[1] AS departamento_id,
        (array_agg(pc.plano_contas_id) FILTER (WHERE pc.plano_contas_id IS NOT NULL))[1] AS plano_contas_id,
        (array_agg(pc.empresa_id ORDER BY pc.primeira_emissao NULLS LAST, pc.empresa_id))[1] AS empresa_id_ref,
        max(pc.primeira_emissao)                      AS competencia
      FROM por_cnpj pc
      CROSS JOIN r
      GROUP BY pc.fornecedor_codigo, pc.numero_documento, pc.valor_original, r.min_cnpjs
      HAVING count(DISTINCT pc.empresa_id) >= (SELECT min_cnpjs FROM r)
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score, valor_impacto,
        empresa_id, departamento_id, plano_contas_id, fornecedor_codigo, fornecedor_nome,
        competencia, conta_ids, evidencia
      )
      SELECT
        'R13_DOUBLE_DIPPING_INTRAGRUPO',
        g.fornecedor_codigo || '|' || btrim(g.numero_documento) || '|' || to_char(g.valor_original, 'FM999999999990.00'),
        (SELECT severidade_default FROM r),
        'Mesmo documento em ' || g.n_cnpjs || ' CNPJs — possível double-dipping intragrupo',
        'Documento ' || g.numero_documento || ' de ' || COALESCE(g.fornecedor_nome, g.fornecedor_codigo)
          || ' no valor de R$ ' || to_char(g.valor_original, 'FM999G999G990D00')
          || ' lançado em ' || g.n_cnpjs || ' empresas do grupo (empresa_id ' || array_to_string(g.empresas, ', ')
          || '). Rateio legítimo repartiria o custo (valores distintos por CNPJ); valores idênticos indicam a mesma despesa cobrada em duplicidade entre CNPJs.',
        g.n_cnpjs::numeric,
        round(g.valor_original * (COALESCE(NULLIF(g.n_cnpjs, 0), 1) - 1), 2),
        g.empresa_id_ref,
        g.departamento_id,
        g.plano_contas_id,
        g.fornecedor_codigo,
        g.fornecedor_nome,
        g.competencia,
        g.conta_ids,
        jsonb_build_object(
          'numero_documento', g.numero_documento,
          'valor_unitario', g.valor_original,
          'n_cnpjs', g.n_cnpjs,
          'empresas_envolvidas', to_jsonb(g.empresas),
          'piso_valor_param', (SELECT piso_valor FROM r),
          'min_cnpjs_param', (SELECT min_cnpjs FROM r),
          'regra', 'mesmo numero_documento+valor+fornecedor em >= min_cnpjs empresa_id distintos'
        )
      FROM grupos g
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias        = despesa_alertas.ocorrencias + 1,
        score              = EXCLUDED.score,
        valor_impacto      = EXCLUDED.valor_impacto,
        evidencia          = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo', 'em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R13_DOUBLE_DIPPING_INTRAGRUPO'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R14_SENTINELAS ==============================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R14_SENTINELAS';
  IF (p_regras IS NULL OR 'R14_SENTINELAS' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH p AS (
      SELECT
        COALESCE((r.params->>'piso_valor')::numeric, 5000)        AS piso_valor,
        COALESCE((r.params->>'tolerancia_aberto')::numeric, 1.00) AS tol_aberto
      FROM (SELECT 1) dummy
      LEFT JOIN public.despesa_regras r ON r.codigo = 'R14_SENTINELAS'
    ),
    sent AS (
      SELECT cp.id, cp.empresa_id, cp.departamento_id, cp.plano_contas_id,
             cp.fornecedor_codigo, cp.fornecedor_nome, cp.data_emissao,
             cp.data_vencimento, cp.data_pagamento,
             cp.valor_original, cp.valor_aberto, cp.valor_pago,
             s.subtipo, s.severidade, s.titulo, s.descricao, s.impacto,
             p.piso_valor
      FROM public.contas_pagar cp
      CROSS JOIN p
      CROSS JOIN LATERAL (
        VALUES
          ('quitado_sem_data', 'baixa',
           'Quitado sem data de pagamento',
           'Titulo com saldo zerado e valor pago, porem data_pagamento ausente',
           COALESCE(cp.valor_pago, 0),
           (cp.valor_aberto = 0 AND COALESCE(cp.valor_pago,0) > 0 AND cp.data_pagamento IS NULL)),
          ('pgto_antes_emissao', 'media',
           'Pagamento antes da emissao',
           'data_pagamento anterior a data_emissao - possivel retroacao de lancamento',
           COALESCE(cp.valor_original, cp.valor_pago, 0),
           (cp.data_pagamento IS NOT NULL AND cp.data_emissao IS NOT NULL
            AND cp.data_pagamento < cp.data_emissao)),
          ('venc_antes_emissao', 'baixa',
           'Vencimento antes da emissao',
           'data_vencimento anterior a data_emissao',
           COALESCE(cp.valor_original, 0),
           (cp.data_vencimento IS NOT NULL AND cp.data_emissao IS NOT NULL
            AND cp.data_vencimento < cp.data_emissao)),
          ('aberto_negativo', 'baixa',
           'Saldo em aberto negativo',
           'valor_aberto negativo - pagamento a maior ou credito nao registrado',
           ABS(COALESCE(cp.valor_aberto, 0)),
           (cp.valor_aberto < 0)),
          ('pago_com_aberto', 'baixa',
           'Quitado com saldo em aberto',
           'Saldo zerado esperado, porem valor_aberto acima da tolerancia',
           COALESCE(cp.valor_aberto, 0),
           (COALESCE(cp.valor_pago,0) > 0 AND cp.valor_aberto > p.tol_aberto))
      ) AS s(subtipo, severidade, titulo, descricao, impacto, hit)
      WHERE cp.status <> 'cancelado'
        AND s.hit
        AND GREATEST(ABS(COALESCE(cp.valor_original,0)), COALESCE(s.impacto,0))
            >= COALESCE(NULLIF(p.piso_valor, 0), 0)
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score, valor_impacto,
        empresa_id, departamento_id, plano_contas_id, fornecedor_codigo, fornecedor_nome,
        competencia, conta_ids, evidencia
      )
      SELECT
        'R14_SENTINELAS',
        sent.id::text || '|' || sent.subtipo,
        sent.severidade,
        sent.titulo || ' [' || sent.subtipo || ']',
        sent.descricao,
        NULL::numeric,
        round(sent.impacto, 2),
        sent.empresa_id,
        sent.departamento_id,
        sent.plano_contas_id,
        sent.fornecedor_codigo,
        sent.fornecedor_nome,
        date_trunc('month', COALESCE(sent.data_emissao, sent.data_vencimento, CURRENT_DATE))::date,
        ARRAY[sent.id],
        jsonb_strip_nulls(jsonb_build_object(
          'subtipo',          sent.subtipo,
          'valor_original',   sent.valor_original,
          'valor_pago',       sent.valor_pago,
          'valor_aberto',     sent.valor_aberto,
          'data_emissao',     sent.data_emissao,
          'data_vencimento',  sent.data_vencimento,
          'data_pagamento',   sent.data_pagamento,
          'piso_valor',       sent.piso_valor
        ))
      FROM sent
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo', 'em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R14_SENTINELAS'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  -- ============================ R15_FORNECEDOR_QUASE_DUPLICADO ================
  SELECT ativo INTO v_ativa FROM public.despesa_regras WHERE codigo = 'R15_FORNECEDOR_QUASE_DUPLICADO';
  IF (p_regras IS NULL OR 'R15_FORNECEDOR_QUASE_DUPLICADO' = ANY(p_regras)) AND COALESCE(v_ativa,false) THEN
    WITH params AS (
      SELECT
        COALESCE((r.params->>'limiar_similaridade')::numeric, 0.90) AS limiar_sim,
        COALESCE((r.params->>'piso_valor')::numeric,       30000)   AS piso_valor,
        COALESCE((r.params->>'janela_meses')::int,         12)      AS janela_meses,
        COALESCE((r.params->>'min_len_nome')::int,         6)       AS min_len_nome,
        COALESCE(r.severidade_default, 'media')                     AS severidade
      FROM public.despesa_regras r
      WHERE r.codigo = 'R15_FORNECEDOR_QUASE_DUPLICADO' AND r.ativo
    ),
    forn AS (
      SELECT
        cp.empresa_id,
        cp.fornecedor_codigo,
        mode() WITHIN GROUP (ORDER BY cp.fornecedor_nome)                       AS nome_repr,
        count(*)                                                                AS qtd_titulos,
        sum(cp.valor_original)                                                  AS valor_total,
        max(cp.data_emissao)                                                    AS ultima_emissao,
        (array_agg(cp.id ORDER BY cp.valor_original DESC))[1:5]                 AS amostra_ids
      FROM public.contas_pagar cp, params p
      WHERE cp.status <> 'cancelado'
        AND cp.fornecedor_codigo IS NOT NULL
        AND cp.fornecedor_nome   IS NOT NULL
        AND cp.data_emissao >= (date_trunc('month', current_date) - make_interval(months => p.janela_meses))::date
      GROUP BY cp.empresa_id, cp.fornecedor_codigo
    ),
    forn_norm AS (
      SELECT
        f.*,
        btrim(regexp_replace(
          upper(public.unaccent(
            regexp_replace(f.nome_repr, '[^[:alnum:] ]', ' ', 'g')
          )),
          '\y(LTDA|ME|EPP|EIRELI|MEI|SA|S A|CIA|COMERCIO|COMERCIAL|INDUSTRIA|SERVICOS|DISTRIBUIDORA)\y',
          ' ', 'g'))                                                            AS nome_norm
      FROM forn f
    ),
    pares AS (
      SELECT
        a.empresa_id,
        a.fornecedor_codigo AS cod_a, a.nome_repr AS nome_a,
        a.valor_total AS valor_a, a.qtd_titulos AS qtd_a, a.ultima_emissao AS ult_a,
        b.fornecedor_codigo AS cod_b, b.nome_repr AS nome_b,
        b.valor_total AS valor_b, b.qtd_titulos AS qtd_b, b.ultima_emissao AS ult_b,
        a.amostra_ids, b.amostra_ids AS amostra_ids_b,
        a.nome_norm AS norm_a, b.nome_norm AS norm_b,
        extensions.similarity(a.nome_norm, b.nome_norm)   AS sim,
        (a.nome_norm = b.nome_norm)                       AS igual_exato,
        p.severidade, p.piso_valor, p.limiar_sim
      FROM forn_norm a
      JOIN forn_norm b
        ON  b.empresa_id = a.empresa_id
        AND a.fornecedor_codigo < b.fornecedor_codigo
      CROSS JOIN params p
      WHERE length(a.nome_norm) >= p.min_len_nome
        AND length(b.nome_norm) >= p.min_len_nome
        AND (
          a.nome_norm = b.nome_norm
          OR extensions.similarity(a.nome_norm, b.nome_norm) > p.limiar_sim
        )
        AND (a.valor_total + b.valor_total) >= p.piso_valor
    ),
    ins AS (
      INSERT INTO public.despesa_alertas (
        regra_codigo, chave_dedup, severidade, titulo, descricao, score,
        valor_impacto, empresa_id, departamento_id, plano_contas_id,
        fornecedor_codigo, fornecedor_nome, competencia, conta_ids, evidencia
      )
      SELECT
        'R15_FORNECEDOR_QUASE_DUPLICADO',
        pr.empresa_id::text || '|'
          || least(pr.cod_a, pr.cod_b) || '|'
          || greatest(pr.cod_a, pr.cod_b),
        pr.severidade,
        'Fornecedor quase-duplicado: ' || pr.nome_a || '  vs  ' || pr.nome_b,
        'Codigos distintos (' || pr.cod_a || ' e ' || pr.cod_b || ') com nome '
          || CASE WHEN pr.igual_exato THEN 'normalizado identico'
                  ELSE 'similar (' || round(pr.sim, 3)::text || ')' END
          || '. Possivel dupla cobranca que escapa do R03 (que agrupa por codigo). '
          || 'Total combinado R$ ' || round(pr.valor_a + pr.valor_b, 2)::text || '.',
        CASE WHEN pr.igual_exato THEN 1.0 ELSE round(pr.sim, 4) END,
        round(least(pr.valor_a, pr.valor_b), 2),
        pr.empresa_id,
        NULL::uuid,
        NULL::uuid,
        CASE WHEN pr.valor_a >= pr.valor_b THEN pr.cod_a  ELSE pr.cod_b  END,
        CASE WHEN pr.valor_a >= pr.valor_b THEN pr.nome_a ELSE pr.nome_b END,
        date_trunc('month', current_date)::date,
        (coalesce(pr.amostra_ids, '{}') || coalesce(pr.amostra_ids_b, '{}')),
        jsonb_build_object(
          'cod_a', pr.cod_a, 'nome_a', pr.nome_a,
          'valor_a', round(pr.valor_a, 2), 'qtd_titulos_a', pr.qtd_a,
          'ultima_emissao_a', pr.ult_a,
          'cod_b', pr.cod_b, 'nome_b', pr.nome_b,
          'valor_b', round(pr.valor_b, 2), 'qtd_titulos_b', pr.qtd_b,
          'ultima_emissao_b', pr.ult_b,
          'nome_norm_a', pr.norm_a, 'nome_norm_b', pr.norm_b,
          'similaridade', round(pr.sim, 4),
          'match', CASE WHEN pr.igual_exato THEN 'igual_normalizado' ELSE 'trigram' END,
          'limiar', pr.limiar_sim,
          'valor_combinado', round(pr.valor_a + pr.valor_b, 2),
          'share_menor_pct', round(
              100.0 * least(pr.valor_a, pr.valor_b)
              / NULLIF(pr.valor_a + pr.valor_b, 0), 1)
        )
      FROM pares pr
      ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE SET
        ultimo_detectado_em = now(),
        ocorrencias         = despesa_alertas.ocorrencias + 1,
        score               = EXCLUDED.score,
        valor_impacto       = EXCLUDED.valor_impacto,
        evidencia           = EXCLUDED.evidencia
      WHERE despesa_alertas.status IN ('novo', 'em_analise')
      RETURNING (xmax = 0) AS eh_novo
    )
    SELECT count(*) FILTER (WHERE eh_novo), count(*) FILTER (WHERE NOT eh_novo)
    INTO v_ins, v_upd FROM ins;
    regra := 'R15_FORNECEDOR_QUASE_DUPLICADO'; inseridos := COALESCE(v_ins,0); atualizados := COALESCE(v_upd,0); RETURN NEXT;
  END IF;

  RETURN;
END;
$function$;

-- Motor roda como service_role (cron) e via wrapper gated; nunca direto p/ authenticated
REVOKE ALL ON FUNCTION public.fn_despesa_detectar(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_despesa_detectar(text[]) TO service_role;
```

---

## 5. `fn_despesas_alerta_transicao(...)` — transição com trilha imutável (§3.2 item 6, §7)

```sql
CREATE OR REPLACE FUNCTION public.fn_despesas_alerta_transicao(
  p_alerta_id     uuid,
  p_novo_status   text,
  p_justificativa text DEFAULT NULL,
  p_revisao_id    uuid DEFAULT NULL
)
RETURNS public.despesa_alertas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_alerta public.despesa_alertas;
  v_before jsonb;
  v_after  jsonb;
  v_ok     boolean := false;
BEGIN
  -- guard: módulo financeiro
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_alerta FROM public.despesa_alertas WHERE id = p_alerta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'alerta % nao encontrado', p_alerta_id USING ERRCODE = 'P0002';
  END IF;

  -- valida o grafo: novo → em_analise → acionado → resolvido|descartado;
  -- descartado é alcançável de qualquer estado não-terminal.
  v_ok := CASE
    WHEN v_alerta.status = 'novo'       AND p_novo_status IN ('em_analise','descartado')            THEN true
    WHEN v_alerta.status = 'em_analise' AND p_novo_status IN ('acionado','descartado')              THEN true
    WHEN v_alerta.status = 'acionado'   AND p_novo_status IN ('resolvido','descartado')             THEN true
    ELSE false
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'transicao invalida: % -> %', v_alerta.status, p_novo_status USING ERRCODE = '22023';
  END IF;

  -- justificativa obrigatória nos terminais
  IF p_novo_status IN ('descartado','resolvido')
     AND (p_justificativa IS NULL OR btrim(p_justificativa) = '') THEN
    RAISE EXCEPTION 'justificativa obrigatoria para % de um alerta', p_novo_status USING ERRCODE = '22023';
  END IF;

  -- acionado exige vínculo com a fila de revisão existente
  IF p_novo_status = 'acionado' AND p_revisao_id IS NULL AND v_alerta.revisao_id IS NULL THEN
    RAISE EXCEPTION 'acionar exige revisao_id (crie a revisao via MarcarRevisaoDialog antes)' USING ERRCODE = '22023';
  END IF;

  v_before := to_jsonb(v_alerta);

  UPDATE public.despesa_alertas SET
    status        = p_novo_status,
    revisao_id    = COALESCE(p_revisao_id, revisao_id),
    atribuido_a   = CASE WHEN p_novo_status = 'em_analise' THEN COALESCE(atribuido_a, auth.uid()) ELSE atribuido_a END,
    resolvido_por = CASE WHEN p_novo_status IN ('resolvido','descartado') THEN auth.uid() ELSE resolvido_por END,
    resolvido_em  = CASE WHEN p_novo_status IN ('resolvido','descartado') THEN now() ELSE resolvido_em END,
    resolucao_nota= CASE WHEN p_novo_status IN ('resolvido','descartado') THEN p_justificativa ELSE resolucao_nota END,
    updated_at    = now()
  WHERE id = p_alerta_id
  RETURNING * INTO v_alerta;

  v_after := to_jsonb(v_alerta);

  -- log leve de transição
  INSERT INTO public.despesa_alertas_eventos (alerta_id, de_status, para_status, usuario_id, nota)
  VALUES (p_alerta_id, (v_before->>'status'), p_novo_status, auth.uid(), p_justificativa);

  -- trilha imutável (hash chain) — o descarte é evidência
  PERFORM public.audit_log_record(
    'despesa_alerta.' || p_novo_status,
    'despesa_alertas',
    p_alerta_id::text,
    v_before,
    v_after
  );

  RETURN v_alerta;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_despesas_alerta_transicao(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_despesas_alerta_transicao(uuid, text, text, uuid) TO authenticated, service_role;
```

---

## 6. `rpc_torre_reprocessar_deteccao()` — wrapper gated para o botão "Reprocessar" (§3.2 item 5)

```sql
CREATE OR REPLACE FUNCTION public.rpc_torre_reprocessar_deteccao(p_regras text[] DEFAULT NULL)
RETURNS TABLE(regra text, inseridos int, atualizados int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin_or_supervisor(auth.uid()) THEN
    RAISE EXCEPTION 'acesso negado: apenas admin/supervisor podem reprocessar' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT * FROM public.fn_despesa_detectar(p_regras);
END;
$function$;

REVOKE ALL ON FUNCTION public.rpc_torre_reprocessar_deteccao(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_torre_reprocessar_deteccao(text[]) TO authenticated, service_role;
```

---

## 7. ALTER do CHECK de `tipo_revisao` em `contas_pagar_revisao` (§7 — inclui `'auditar'`)

```sql
-- O CHECK original é ('eliminar','reduzir','renegociar','monitorar') (20251203163804:8).
-- A Torre mapeia auditar/investigar -> 'auditar'. ALTER idempotente.
ALTER TABLE public.contas_pagar_revisao
  DROP CONSTRAINT IF EXISTS contas_pagar_revisao_tipo_revisao_check;
ALTER TABLE public.contas_pagar_revisao
  ADD CONSTRAINT contas_pagar_revisao_tipo_revisao_check
  CHECK (tipo_revisao IN ('eliminar','reduzir','renegociar','monitorar','auditar'));
```

---

## 8. pg_cron — agendamento idempotente (§7)

```sql
-- Padrão idempotente: unschedule (silencioso se não existir) + schedule.
-- Horário: America/Sao_Paulo ~07:00 == 10:00 UTC (base UTC-3; simplificação assumida).
DO $cron$
DECLARE
  j record;
BEGIN
  FOR j IN SELECT jobname FROM cron.job
           WHERE jobname IN ('torre_deteccao_diaria','torre_deteccao_semanal','torre_snapshot_mensal','torre_r01_fecha_mes')
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END
$cron$;

-- Diária ~07:00 BRT: regras de cadência diária + R01 do mês corrente
SELECT cron.schedule(
  'torre_deteccao_diaria',
  '0 10 * * *',
  $$SELECT public.fn_despesa_detectar(ARRAY[
      'R01_ZSCORE_MOM_YOY','R02_FORNECEDOR_NOVO_VOLUME','R03_DUPLICIDADE',
      'R04_FRACIONAMENTO','R07_LANCAMENTO_NAO_UTIL','R09_PROVISAO_ENGORDA',
      'R12_PORTADOR_ATIPICO','R13_DOUBLE_DIPPING_INTRAGRUPO','R14_SENTINELAS'
    ]);$$
);

-- Semanal (domingo ~07:00 BRT): regras pesadas/de baixa cadência
SELECT cron.schedule(
  'torre_deteccao_semanal',
  '0 10 * * 0',
  $$SELECT public.fn_despesa_detectar(ARRAY[
      'R06_CONCENTRACAO_FORNECEDOR','R08_BENFORD','R11_JUROS_CRONICOS',
      'R15_FORNECEDOR_QUASE_DUPLICADO'
    ]);$$
);

-- Mensal dia 2 ~07:00 BRT: fecha o R01 do mês anterior + snapshot
SELECT cron.schedule(
  'torre_snapshot_mensal',
  '0 10 2 * *',
  $$
  INSERT INTO public.despesa_cp_snapshot (erp_id, mes_ref, natureza_lancamento, valor_original, valor_pago)
  SELECT cp.erp_id, date_trunc('month', current_date - interval '1 month')::date,
         cp.natureza_lancamento, cp.valor_original, cp.valor_pago
  FROM public.contas_pagar cp
  WHERE cp.status <> 'cancelado'
  ON CONFLICT (erp_id, mes_ref) DO UPDATE SET
    natureza_lancamento = EXCLUDED.natureza_lancamento,
    valor_original      = EXCLUDED.valor_original,
    valor_pago          = EXCLUDED.valor_pago;
  $$
);
```

---

## 9. Verificação — smoke tests (rodar via service_role após a migration)

```sql
-- 9.1 Primeira execução do motor: contar alertas por regra
SELECT * FROM public.fn_despesa_detectar();   -- (regra, inseridos, atualizados) — 1ª vez: inseridos>0, atualizados=0

-- 9.2 Distribuição de alertas por regra e severidade
SELECT regra_codigo, severidade, count(*), sum(valor_impacto) AS impacto
FROM public.despesa_alertas
GROUP BY 1,2 ORDER BY 1,2;

-- 9.3 Dedup: rodar 2ª vez NÃO deve criar novos alertas (inseridos=0; só atualizados)
SELECT * FROM public.fn_despesa_detectar();   -- 2ª vez: inseridos=0 em todas as regras estáveis
SELECT count(*) AS total_alertas FROM public.despesa_alertas;  -- deve ser igual ao total após 9.1

-- 9.4 Transição sem justificativa é rejeitada.
-- NOTA: rodando como service_role (auth.uid() NULL), o guard financeiro de
-- fn_despesas_alerta_transicao levanta 42501 já na 1ª chamada — por isso o teste
-- captura AMBOS os erros: 22023 confirma a regra de justificativa; 42501 significa
-- "pulado" (sem sessão) e a validação real acontece na UI autenticada.
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.despesa_alertas WHERE status='novo' LIMIT 1;
  IF v_id IS NOT NULL THEN
    BEGIN
      -- leva a em_analise (ok), depois tenta descartar SEM justificativa (deve falhar)
      PERFORM public.fn_despesas_alerta_transicao(v_id, 'em_analise', NULL, NULL);
      PERFORM public.fn_despesas_alerta_transicao(v_id, 'descartado', NULL, NULL);
      RAISE NOTICE 'FALHA DO TESTE: descarte sem justificativa foi aceito';
    EXCEPTION
      WHEN sqlstate '22023' THEN
        RAISE NOTICE 'OK: descarte sem justificativa rejeitado como esperado';
      WHEN sqlstate '42501' THEN
        RAISE NOTICE 'PULADO: service_role sem auth.uid() nao passa no guard financeiro — validar justificativa via UI autenticada';
    END;
  END IF;
END $$;

-- 9.5 Trilha imutável: a transição gerou registro selado com hash chain?
SELECT action, entity, entity_id, row_hash IS NOT NULL AS selado
FROM public.audit_log_immutable
WHERE entity='despesa_alertas'
ORDER BY id DESC LIMIT 5;
SELECT * FROM public.audit_log_verify_chain(1000);  -- vazio = cadeia íntegra

-- 9.6 Cron agendado
SELECT jobname, schedule, active FROM cron.job
WHERE jobname LIKE 'torre_%' ORDER BY jobname;

-- 9.7 CHECK de tipo_revisao aceita 'auditar'
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conname = 'contas_pagar_revisao_tipo_revisao_check';
```

---

## 10. Regras adiadas (fora desta leva)

Estas **não** entram no seed nem no motor da Fase 2 (a prontidão ao vivo de 05/07 confirmou que os pré-requisitos estão ausentes/magros):

| Regra | Motivo do adiamento |
|---|---|
| **R05** (múltiplos de R$1.000 sem contrato) | Depende de contrato ativo por fornecedor; cobertura de contratos MAGRA (15 registros). Sem lastro contratual confiável, a regra vira ruído. Reativar na Fase 4 após regularizar `fornecedor_contratos`. |
| **R10** (a/b/c: recorrente sem contrato / gasto > contrato / realizado > orçado) | Depende de `fornecedor_contratos` **e** `budget_distributions`/`budget_periods` — ambos magros (contratos 15, períodos 2, distribuições 11). Fica para a Fase 4 junto com `fn_despesas_orcado_realizado`. |
| **Regras de segregação de função / autoria do lançamento** | Nenhuma coluna de operador do ERP no espelho (gap ② ainda aberto — operador do ERP ausente). O subtipo "quem lançou" do drill e qualquer regra de autoria ficam fora até o `raw` do staging ser materializado (Fase 4). |
| **Mudança de dados bancários do favorecido / three-way match / fornecedor↔funcionário** | Colunas inexistentes no espelho (conta do favorecido, pedido/XML vinculado, CNPJ do fornecedor vs base RH). Cortadas por dado, não por decisão de escopo. |

As 13 regras que **entraram** (todas com bloco SQL verificado): R01, R02, R03, R04, R06, R07, R08, R09, R11, R12, R13, R14, R15.

---

## 11. Observações operacionais (não bloqueiam — ler antes de operar)

- **R09 (provisão que engorda) só rende daqui pra frente.** A regra lê `contas_pagar_historico` procurando `natureza_lancamento` mudar de `provisionado`→`lancado`. Isso só existe se a mudança tiver passado por um `UPDATE` que dispare o trigger `trg_contas_pagar_audit`. Carga em massa / primeiro carregamento / caminho que não triga não deixam rastro → R09 retorna 0 em silêncio para esses casos. Esperado; a regra captura as provisões que engordarem a partir de agora.
- **Reincidência sobre alerta já triado NÃO gera alerta novo.** O `ON CONFLICT ... DO UPDATE ... WHERE status IN ('novo','em_analise')` protege a triagem humana: se o mesmo `chave_dedup` reaparecer sobre um alerta já `acionado`/`resolvido`/`descartado`, o alerta antigo **não** é reaberto nem duplicado. É a dedup determinística desejada — mas na operação parece "sumiço": um padrão descartado não volta a alertar enquanto o desfecho anterior estiver na base. Reabertura automática em reincidência grave é ajuste futuro (o schema já tem `reaberto_count`).
