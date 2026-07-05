# ARQUITETURA FINAL — TORRE DE CONTROLE DE DESPESAS
**Grupo Union / ERP Result → Huugs · `public.contas_pagar` (50.987 títulos, 11 empresas)**
Documento consolidado (regras forenses + arquitetura de sistema). Destino sugerido: `docs/ARQUITETURA-TORRE-CONTROLE-DESPESAS.md`.

**Conflitos resolvidos entre os dois desenhos (registro das decisões):**
1. **Schema de alertas**: adotado o par `despesa_regras` + `despesa_alertas` com `regra_codigo`/`chave_dedup`/`conta_ids[]`/ciclo de vida (versão forense) — o catálogo parametrizável sem redeploy e o anti-realerta com reabertura são superset do enum fixo `tipo_alerta` da versão arquitetural.
2. **Tipos das dimensões**: `empresa_id integer` (não uuid) — `contas_pagar.empresa_id` é `INTEGER NOT NULL` (`supabase/migrations/20251201053218_554b7e6f-a273-4cc2-b1c8-2848303656bf.sql:9`) e as RPCs existentes usam `p_empresa_ids integer[]` (`20260705042549:7,30`); `plano_contas_id uuid REFERENCES trade_chart_of_accounts(id)` mantido da versão arquitetural.
3. **Motor de detecção**: SQL puro `fn_despesa_detectar` + pg_cron (versão forense), **não** edge function — 50k linhas é trivial para SQL set-based, elimina superfície de deploy, e o on-demand se resolve com RPC gated; a edge fica só para a IA.
4. **Vocabulário de estados**: `novo → em_analise → acionado → resolvido | descartado` — funde `acao_definida`(forense)→`acionado`(arquitetura, mais curto e igual às tabs da UI); `aceito` da arquitetura vira `descartado` com nota "aceito como legítimo" (dois terminais bastam).
5. **Transições**: exclusivamente via RPC `fn_despesas_alerta_transicao` SECURITY DEFINER (versão arquitetural) — sem policy de UPDATE para authenticated, garantindo justificativa obrigatória e trilha imutável em todo desfecho.

---

## 1. Visão

A empresa atravessa uma crise financeira com suspeita concreta de fraude interna. O Contas a Pagar acabou de se tornar espelho autoritativo do ERP Result — 50.987 títulos com natureza (provisionado/lançado), plano de contas 100% classificado, centro de custo em 99,6% e datas reais. A Torre de Controle de Despesas transforma esse espelho em vigilância ativa: cada departamento passa a ter sua despesa acompanhada mês a mês (MoM/YoY), com detecção automática de padrões que humanos não enxergam em 50 mil linhas — fornecedor novo faturando pesado, notas fracionadas para fugir de alçada, o mesmo documento cobrado em duas empresas do grupo, provisão aprovada por X e efetivada por X+Δ. O objetivo de negócio é duplo: **estancar vazamento** (cada alerta carrega o valor em risco, priorizando onde o dinheiro sai) e **blindar a gestão** (toda decisão sobre um alerta — inclusive descartá-lo — fica registrada em trilha de auditoria imutável com hash chain, evidência defensável se o caso virar disputa judicial ou trabalhista).

A arquitetura separa deliberadamente três camadas: **detecção determinística** (SQL reproduzível, auditável em juízo — a mesma query com os mesmos dados dá o mesmo alerta), **triagem humana** (fila de ação com justificativa obrigatória, reusando o fluxo de revisão de gastos que já existe) e **leitura por IA** (interpretação executiva por cima dos alertas, nunca criando alertas — a IA narra e prioriza, não acusa). Quem lança conta não decide o destino do alerta sobre a própria conta; quem descarta um alerta assina o descarte. A Torre nasce protegendo a empresa contra o fraudador e protegendo o gestor honesto contra a dúvida.

---

## 2. O que já existe e será reutilizado

| Ativo | Onde | Papel na Torre |
|---|---|---|
| `contas_pagar` (espelho Result, 50.987 títulos) | `20251201053218` + colunas posteriores | Fonte única de fatos; escopo sync = `importado_api=false AND codigo_integracao IS NULL` (`20260704214256:32-33`) |
| `natureza_lancamento` CHECK provisionado/lancado | `20260704193828:2-12` | Segmentação de todas as séries e regra R09 |
| Molde de RPC agregada com guard | `fn_cp_dashboard`, `20260705042549:6-57` (guard `:21-23`, base `:26-36`, REVOKE/GRANT `:194-204`) | Padrão literal das 3 RPCs novas |
| Trigger de auditoria campo-a-campo | `trg_contas_pagar_audit` → `contas_pagar_historico`, `20260324015813:3-48` | Viabiliza R09 (provisão que engorda) e forense de edições em FDS |
| Cadeia imutável | `audit_log_record`/`audit_log_immutable` (seal/block/verify), `20260501023237:38,76,111,142` | Trilha de toda transição de alerta |
| Fila de ação existente | `contas_pagar_revisao` + `revisao_eventos` (`20251203163804:2-21`, RLS `:34-56`; `20251203165637:2`) + `MarcarRevisaoDialog` (insert `:171-196`) + `PlanoReducaoGastos`/`RevisaoGastosCard` | A ação operacional vive aqui — **não** se cria fila paralela |
| Regras determinísticas efêmeras | `supabase/functions/auditoria-contas-pagar/index.ts:102-383` | Absorvidas/persistidas como R03 (fraca em `:346-383`), R11 (`:152,189`) e R14 |
| Molde de IA estruturada | `expense-ai-assistant/index.ts:725-895` (action `audit_reduction_plan`, schema `:792-853`, gemini-2.5-pro `:887`) + `AuditReductionDialog` (RiskGauge `:48-67`) + shape `AuditReductionResult` em `src/hooks/useExpenseAI.ts` | Leitura executiva da Fase 3 renderiza quase sem mudança |
| Molde de relatório persistido | `pedidos_copilot_relatorios`, `20260702013001:3-27` | Gabarito de `despesa_relatorios_ia` |
| Contratos e orçamento | `fornecedor_contratos` (`20260525024912:3-24`), `budget_distributions`/`budget_periods` (`20260625144549:72`) | R05 (whitelist), R10 (variantes a/b/c) — cobertura a confirmar |
| Feriados | `public.feriados` via BrasilAPI, `20260426235810:16-31` | R07 |
| pg_cron idempotente + pg_trgm | `20260407122217:30-31`, exemplo `20260417205405:14`; `20260501022951:8` | Agendamento do motor; `similarity()` no R15 |
| Padrões de UI financeira | `ContasPagarHeaderKpis.tsx` (`:19-31,98-116`), `FinanceiroChartsGrid.tsx` (`:78,167`), `DepartmentDashboard.tsx:31-85`, `ContaPagarDetalhe.tsx:63-83`, `DetalheLancamentoDialog` (padrão `DREAnalitico.tsx:2139-2146`), `SofiaFloatingChat` (`ContasAPagar.tsx:1704`), hooks server-side `ContasAPagar.tsx:239-281` | Todos os blocos da tela |
| Classificador de departamento | `ap-reclassificar-contas/index.ts:166-188` (fallback Administrativo conf 0.72/0.58) + jobs `20260705021146:101-154`, `20260705021432:1-96` | Filtro anti-ruído + Fase 4 de cobertura |

**Anti-padrões a NÃO repetir**: paginação client-side de `contas_pagar` (`ContasPagarDREView.tsx:142-158`); RLS `USING(true)` (`planos_reducao`, `20260406153414:12`); Sofia com service-role sem corte de empresa (`contas-pagar-ai-chat`); reusar `variacao_mensal_pct` de `fn_cp_kpis_avancados:109-111` para MoM de despesa (mede outra coisa).

**Premissas transversais**: base de valor = `valor_original`; eixo temporal = `data_emissao` (proxy de competência; **gap ① JÁ FECHADO em 05/07/2026** — migration `20260705053801` adicionou `data_pagamento` ao UPDATE do transform e a re-carga limpou as datas fantasmas (4.800→223 resíduos): `data_pagamento` = data real `Data_Mtpg` op2, utilizável como eixo alternativo desde já); filtro anti-ruído = excluir/segmentar `departamento_nome='Administrativo' AND confianca_classificacao<0.7 AND classificacao_manual IS NOT TRUE`; piso de materialidade paramétrico em toda regra; séries separadas por `natureza_lancamento` onde fizer sentido; lançamentos manuais Huugs entram com flag `origem` na evidência.

---

## 3. Modelo de dados

### 3.1 Tabelas novas (prompt Lovable — Supabase é gerido pelo Lovable)

```sql
-- Catálogo de regras: parametrização sem redeploy
CREATE TABLE public.despesa_regras (
  codigo text PRIMARY KEY,                       -- 'R03_DUPLICIDADE'
  nome text NOT NULL, descricao text,
  severidade_default text NOT NULL CHECK (severidade_default IN ('critica','alta','media','baixa')),
  params jsonb NOT NULL DEFAULT '{}',            -- {"janela_dias":7,"tolerancia_pct":0.01,"piso_valor":500}
  cadencia text NOT NULL DEFAULT 'diaria' CHECK (cadencia IN ('diaria','semanal','mensal')),
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.despesa_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_codigo text NOT NULL REFERENCES despesa_regras(codigo),
  chave_dedup text NOT NULL,                     -- determinística por regra (catálogo §4)
  severidade text NOT NULL CHECK (severidade IN ('critica','alta','media','baixa')),
  status text NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo','em_analise','acionado','resolvido','descartado')),
  origem text NOT NULL DEFAULT 'deterministico' CHECK (origem IN ('deterministico','manual')),
  titulo text NOT NULL, descricao text,
  score numeric,                                 -- z, χ², share...
  valor_impacto numeric(14,2),                   -- R$ em risco (ranking)
  -- dimensões (nullable; cada regra preenche o que tem)
  empresa_id integer,
  departamento_id uuid REFERENCES departamentos(id),
  plano_contas_id uuid REFERENCES trade_chart_of_accounts(id),
  centro_custo_id uuid,
  fornecedor_codigo text, fornecedor_nome text,
  competencia date,
  conta_ids uuid[] DEFAULT '{}',                 -- títulos-evidência (drill direto)
  evidencia jsonb NOT NULL DEFAULT '{}',
  -- ciclo de vida / dedup
  primeiro_detectado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_detectado_em timestamptz NOT NULL DEFAULT now(),
  ocorrencias int NOT NULL DEFAULT 1, reaberto_count int NOT NULL DEFAULT 0,
  -- elo com a fila existente (NUNCA fila paralela)
  revisao_id uuid REFERENCES contas_pagar_revisao(id),
  atribuido_a uuid, resolvido_por uuid, resolvido_em timestamptz, resolucao_nota text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regra_codigo, chave_dedup)             -- coração do anti-realerta
);
CREATE INDEX idx_despesa_alertas_abertos ON despesa_alertas (severidade, valor_impacto DESC)
  WHERE status IN ('novo','em_analise');
CREATE INDEX idx_despesa_alertas_dept ON despesa_alertas (departamento_id, status);
CREATE INDEX idx_despesa_alertas_forn ON despesa_alertas (fornecedor_codigo);

-- Log leve de transições (a trilha pesada vai p/ audit_log_immutable)
CREATE TABLE public.despesa_alertas_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alerta_id uuid NOT NULL REFERENCES despesa_alertas(id) ON DELETE CASCADE,
  de_status text, para_status text, usuario_id uuid, nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Relatórios da IA (Fase 3; molde pedidos_copilot_relatorios 20260702013001:3-27, mas team-wide)
CREATE TABLE public.despesa_relatorios_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo date NOT NULL, filtros jsonb NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL, markdown text, model text,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);

-- Snapshot mensal leve (robustez do R09 + provisão fantasma; populado pelo cron)
CREATE TABLE public.despesa_cp_snapshot (
  erp_id text NOT NULL, mes_ref date NOT NULL,
  natureza_lancamento text, valor_original numeric, valor_pago numeric,
  PRIMARY KEY (erp_id, mes_ref)
);
```

**Índices em `contas_pagar`** (mesmo prompt): `(data_emissao) WHERE status <> 'cancelado'`; `(departamento_id, data_emissao)`; `(fornecedor_codigo, data_emissao)` — já existem `(departamento_id, plano_contas_id)` (`20251201071303:2-6`) e centro_custo (`20260409122301:45-48`).

**RLS**: `despesa_alertas`/`eventos`/`relatorios_ia` — SELECT para authenticated com `check_user_access(auth.uid(),'financeiro')` (padrão `20260705042549:160-188`); **nenhuma policy de INSERT/UPDATE/DELETE para authenticated** — escrita só via funções SECURITY DEFINER (motor = service_role; transição = RPC gated). Não repetir o `USING(true)` de `20260406153414:12`. Decisão em aberto #2 (§10) pode restringir SELECT a admin/supervisor.

### 3.2 RPCs (molde exato = `fn_cp_dashboard` `20260705042549:6-57`)

Todas `RETURNS jsonb, LANGUAGE plpgsql, STABLE SECURITY DEFINER, SET search_path=public`; guard `check_user_access(auth.uid(),'financeiro')` com ERRCODE 42501 (`:21-23`); CTE `base` com `status<>'cancelado' AND user_has_empresa_access(auth.uid(), cp.empresa_id)` linha a linha (`:26-36`); `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO authenticated`. Parâmetros comuns: `p_empresa_ids integer[]`, `p_natureza text` (provisionado|lancado|NULL), `p_base_data text DEFAULT 'emissao'`, `p_conf_minima numeric DEFAULT NULL`.

1. **`fn_despesas_departamentos(p_meses int DEFAULT 13, p_mes_ref date, ..., p_incluir_sem_depto boolean DEFAULT true)`** — série mensal por departamento com `generate_series` × departamentos (zera meses vazios; sem isso LAG quebra), `LAG(1)`/`LAG(12)` para MoM/YoY, `avg/stddev_samp` 12m para z-score. Retorna `{meta, qualidade{valor_sem_depto, pct_baixa_conf}, totais{serie}, departamentos[{...z_mes_ref, share_pct, serie[]}]}`. Bucket `departamento_id IS NULL` entra como pseudo-departamento "(sem classificação)" — departamento é 100% classificação pós-carga (o transform nunca toca `departamento_id`, `20260704214256:7-46`); esconder o buraco mentiria a série.
2. **`fn_despesas_drill(p_nivel text, p_mes date, p_departamento uuid, p_sem_depto bool, p_plano_contas_id uuid, p_fornecedor_codigo text, ..., p_limit int, p_offset int)`** — três níveis: `'plano'` (grupo por plano IFRS-18, `20260705032837:328-337`), `'fornecedor'` (formato de `get_fornecedor_metricas_reducao`, `20260406152455:2`, + `primeiro_lancamento` como feature forense), `'titulos'` (paginado, cada `id` → `ContaPagarDetalhe.tsx:63-83` ou `DetalheLancamentoDialog`).
3. **`fn_despesas_variacoes(p_mes date, ..., p_min_valor numeric DEFAULT 5000, p_limit int DEFAULT 25)`** — grão `departamento×plano×fornecedor`; retorna `top_altas/top_quedas/novos_fornecedores/reativados/duplicidades_mes` com `{valor_mes, mom_pct, yoy_pct, media_6m, z_6m, share_depto_pct, conta_ids}`. **É a Fase 1 da detecção** — variações com contexto antes do motor existir.
4. **`fn_despesa_detectar(p_regras text[] DEFAULT NULL)`** — motor (§4/§7): SECURITY DEFINER, um bloco upsert por regra ativa lendo `despesa_regras.params`, `RETURNS TABLE(regra, inseridos, atualizados)`; `REVOKE FROM anon, authenticated; GRANT TO service_role` (padrão dos transforms `20260705042549:194-204`).
5. **`rpc_torre_reprocessar_deteccao()`** — wrapper gated (admin/supervisor + financeiro) para o botão "Reprocessar" e pós-`solicitar_sync_rubysp` (`20260705042549:210-231`).
6. **`fn_despesas_alerta_transicao(p_alerta_id uuid, p_novo_status text, p_justificativa text, p_revisao_id uuid)`** — valida grafo de estados; `RAISE` se `descartado` sem justificativa; grava `despesa_alertas_eventos` + `audit_log_record('despesa_alerta.'||status,'despesa_alertas', id, before, after)`.
7. *(Fase 4)* **`fn_despesas_orcado_realizado`** — `budget_distributions.valor_alocado` × agregado de `contas_pagar` por período×departamento (a view `vw_budget_distribution_kpis` NÃO serve — o realizado dela vem de `department_expenses`).

**Upsert anti-realerta do motor**: `ON CONFLICT (regra_codigo, chave_dedup) DO UPDATE` atualizando `ultimo_detectado_em/ocorrencias/score/valor_impacto/evidencia`; reabre (`status='novo'`, `reaberto_count+1`) **só** se estava `resolvido/descartado` E `valor_impacto` novo > 1,5× o anterior; nunca sobrescreve triagem humana em curso.

---

## 4. Catálogo de regras de detecção

SQL completo de cada regra já validado no desenho forense (mantido como especificação do corpo de `fn_despesa_detectar`). Severidades na taxonomia da `auditoria-contas-pagar` (critica/alta/media/baixa).

| # | Regra | O que pega | Severidade | FP esperado | Cadência | Chave dedup |
|---|---|---|---|---|---|---|
| R01 | z-score MoM/YoY por dept×plano (janela 12m, n≥6 meses, piso R$10k) | Salto de categoria fora do padrão — desperdício emergente, reajuste sem aprovação, canal de desvio | alta (z≥3 ou YoY≥+100%); media (2≤z<3) | média (sazonalidade; mitigada pelo YoY na mesma query) | mensal dia 2 + diária do mês corrente | `dept\|plano\|mes` |
| R02 | Fornecedor novo (1ª emissão ≤90d) com ≥R$50k acumulado ou título ≥R$30k | Shell company / fornecedor fantasma (ACFE billing scheme); base full-history torna "primeira emissão" confiável (`connector-rubysp/src/connector-contas-pagar.js:34-57`) | alta; critica se ≥R$200k ou dept já flagado por R01 | baixa-média | diária | `fornecedor_codigo` |
| R03 | Duplicidade: mesmo fornecedor+empresa, valor ±1%, janela 7d, erp_id distinto, **excluindo** mesmo `numero_documento` com `parcela` diferente | Mesma despesa lançada/paga 2× — erro ou refaturamento; substitui a versão fraca da edge (`index.ts:346-383`) | critica se ambos pagos; alta senão | média (whitelist p/ recorrência quinzenal) | diária | `least\|greatest(erp_id)` |
| R04 | Fracionamento: ≥3 títulos do fornecedor no dia/semana, todos < alçada (param R$10k), soma ≥1,2× alçada | Estruturação para escapar de aprovação; refinar com `stddev/avg<0.25` (fatias parelhas = deliberado) | alta | média-alta (utilities/fretes — whitelist por plano) | diária | `fornecedor\|data` |
| R05 | ≥50% dos títulos múltiplos de R$1.000 (≥6 títulos, ≥R$30k/12m), sem contrato ativo | Serviço fictício/superfaturado "de cabeça" | media (alta se combinada c/ R02/R06) | alta isolada — **usar como fator de score**, não standalone | semanal | `fornecedor\|trimestre` |
| R06 | Share do fornecedor ≥40% do gasto do dept (piso R$30k/90d) E crescendo ≥10 p.p. YoY | Conluio comprador↔fornecedor, kickback | media; alta se share≥60% e fornecedor <24m de casa | média | semanal | `dept\|fornecedor\|trimestre` |
| R07 | Emissão em sábado/domingo/feriado (`feriados` via BrasilAPI), ≥R$5k, excluindo BOLETO/TARIFA/IMPOSTO | Nota de serviço datada em dia não útil; **versão fraca** — `data_emissao` é DATE sem hora/autor | baixa (fator) | alta (e-commerce, energia, telecom) | diária | `conta_id` |
| R08 | Benford 1º dígito, χ² 8 g.l. p<0,01 (>20,09), amostra ≥300 por dept / ≥100 por fornecedor, com dedupe de parcelas | Valores inventados/manipulados em escala (direcionador, nunca prova) | media | média-alta em populações pequenas/preço tabelado | semanal | `escopo\|entidade\|semestre` |
| R09 | Provisionado→lancado com valor >5% e ≥R$500 maior, via `contas_pagar_historico` (trigger `20260324015813:45-48`; mudança do sync = `usuario_id NULL`, esperado) | Infla-se o realizado após aprovação da provisão. Viável **daqui pra frente** (natureza existe desde 04/07); sem retroativo; snapshot mensal dá robustez + variantes provisão-fantasma e lancado-sem-provisão | alta | baixa | diária | `conta_id` |
| R10 | (a) recorrente ≥4 meses ≥R$5k/mês sem contrato ativo; (b) gasto mensal >1,3× `valor_mensal` do contrato; (c) realizado CP >1,1× `valor_alocado` do período | Gasto sem lastro contratual/orçamentário | media (b: alta — extrapolação objetiva) | (a) alta no início — tratar como backlog de regularização; (b) baixa | semanal | `variante\|entidade\|mes` |
| R11 | ≥3 títulos com juros >2% e ≥R$2k somados, ou ≥3 pagos >105% do original, em 6m | Juros crônicos (desperdício quantificável) ou acréscimos fabricados; agrega as versões unitárias da edge (`index.ts:152,189`) | media (também KPI de desperdício) | baixa-média | semanal | `fornecedor\|trimestre` |
| R12 | Título saiu por portador ≠ do habitual (≥6 pagamentos históricos), ≥R$5k | Pagamento roteado fora do rito; limitação: `portador` é banco NOSSO, conta do favorecido não existe no espelho | media | média-alta (supressão se >30% dos fornecedores mudam no mês = troca de banco da empresa) | diária | `fornecedor\|portador\|mes` |
| R13 | Mesmo `numero_documento`+valor+fornecedor em ≥2 dos 11 CNPJs | Double-dipping intragrupo (rateio legítimo tem valores diferentes por CNPJ) | alta | baixa-média | diária | `fornecedor\|doc\|valor` |
| R14 | Sentinelas: quitado sem `data_pagamento`, pgto<emissão, venc<emissão, aberto<0, pago com aberto>0 (persiste as regras da edge `index.ts:102-330`) | Higiene forense + **monitor do gap ①** (série `quitado_sem_data` crescendo = transform quebrado) | baixa-media (media p/ pgto_antes_emissao) | baixa (violações objetivas) | diária | `conta_id\|subtipo` |
| R15 | Fornecedor quase-duplicado: nome normalizado igual ou `similarity()>0.9` (pg_trgm, `20260501022951:8`) sob códigos distintos | Dupla cobrança que escapa do R03 (que agrupa por código) | media | média (filiais legítimas) | semanal | `cod_a\|cod_b` |

**Regras cortadas (colunas não suportam)**: segregação de função/autoria — nenhuma coluna de operador do ERP no espelho (gap ②, `connector-contas-pagar.js:34-57`; extensão de maior valor forense pendente, provável `Usuario_tpg`; o `raw` jsonb do staging `erp_contas_pagar_rubysp.raw` (`20260704212949:24`) pode já conter — verificar via prompt Lovable antes de mexer no conector); mudança de dados bancários do favorecido (coluna inexistente); three-way match (sem pedido/XML vinculados); horário do lançamento (DATE sem hora); fornecedor↔funcionário (sem CNPJ em `contas_pagar` nem base RH).

---

## 5. Tela — `/dashboard/financeiro/torre-despesas`

**Arquivos**: `src/pages/financeiro/TorreDespesas.tsx`; rota em `src/App.tsx` (padrão da linha 856); screenCode único `financeiro_torre_despesas` em menu E guard (não repetir a divergência `financeiro_departamentos` vs `financeiro_visao_dept`); sidebar em Análises Financeiras ao lado de "Visão Departamental" (`AppSidebar.tsx:661`). `VisaoDepartamentos.tsx` fica intacta até a Fase 3 (memória: preservar visual, trocar só a origem). Hooks: `src/hooks/financeiro/useTorreDespesas.ts` (3 `useQuery`→`supabase.rpc`, padrão `ContasAPagar.tsx:239-281`); tipos em `src/types/financeiro/torre-despesas.ts`. Filtros globais da página: empresas multi-select, período preset+range (`DepartmentDashboard.tsx:31-85`), toggle natureza, switch "ocultar classificação fraca" (`p_conf_minima=0.7`).

**Blocos (top→down):**
1. **Header KPIs** — seguir `ContasPagarHeaderKpis.tsx` literalmente (hero col-span-4 `text-4xl tabular-nums font-mono` `:98-105`, sub-métricas `:107-116`, `Kpi` tones `:19-31`): Total do mês (split Provisionado/Lançado no rodapé, padrão `:109-115`), vs mês anterior (MoM), vs ano anterior (YoY), Alertas abertos (Fase 1: conta variações |z|≥2 de `fn_despesas_variacoes`; Fase 2: real). Banner fino de qualidade: "% do valor sem departamento / com confiança baixa" (bloco `qualidade` da RPC 1).
2. **Heatmap departamento × mês** — componente novo `src/components/financeiro/torre/TorreHeatmap.tsx`: linhas=departamentos por total, colunas=13 meses, célula colorida por z-score (tokens `hsl(var(--destructive))`/`hsl(var(--success))` de `src/lib/chart-colors.ts`, nunca hex), tooltip MoM/YoY, clique seleciona `(dept, mês)` e alimenta blocos 3-4; linha "(sem classificação)" destacada.
3. **Série com bandas** — `EvolutionChart` (`FinanceiroChartsGrid.tsx:78`) + `Area` de banda `media_12m ± 2σ`; se não aceitar séries extras por props, variante `TorreSerieChart` reusando `CustomTooltip`/`formatCurrency`.
4. **Painel drill** — breadcrumb departamento→plano→fornecedor→títulos, cada nível = `fn_despesas_drill` (UX de `ContasPagarDREView.tsx:224-280`, mas server-side); fornecedor usa `HorizontalBarChart` (`:167`); títulos paginados com link para detalhe + `CPHistoricoTimeline`; **em cada linha**: botão que abre `MarcarRevisaoDialog` pré-preenchido.
5. **Fila de alertas** (Fase 2) — tabs Novos/Em análise/Acionados/Resolvidos; card com severidade (`kpi-card.tsx` variants), valor de impacto, `evidencia` renderizada; botões: Investigar/Auditar→`MarcarRevisaoDialog` (cria revisão + grava `revisao_id`), Descartar→dialog com justificativa obrigatória; item acionado renderiza `RevisaoGastosCard` compact (timeline `:148-207`).
6. **IA** — `SofiaFloatingChat` montado desde a Fase 1 (1 linha, `ContasAPagar.tsx:1704`); painel "Leitura executiva" (Fase 3) com último relatório + botão gerar, renderizado pelo `AuditReductionDialog`.

---

## 6. IA

**Princípio: detecção determinística primeiro (reproduzível, auditável em juízo); IA por cima, nunca por baixo — a IA consome alertas e agregados, não cria alertas.**

**Fluxo** — edge nova `supabase/functions/despesas-copilot/index.ts` (Fase 3):
1. Entrada `{periodo: 'YYYY-MM', empresa_ids?, departamento_id?}`.
2. Client Supabase **com o Authorization do usuário** (não service-role) — `auth.uid()` flui e os guards `check_user_access`/`user_has_empresa_access` das RPCs valem dentro da edge (corrige o anti-padrão da Sofia).
3. Contexto = SÓ agregados: `fn_despesas_departamentos(13 meses)` + `fn_despesas_variacoes(mes)` + `despesa_alertas` abertos do período — nunca 50k linhas.
4. Molde = action `audit_reduction_plan` (`expense-ai-assistant/index.ts:725-895`): saída estruturada por tool-calling (schema `:792-853`), `google/gemini-2.5-pro` (`:887`).
5. Persiste em `despesa_relatorios_ia` (INSERT service_role pela edge); a tela mostra o último do período + histórico.

**Prompt-estratégia**: contrato de saída = shape `AuditReductionResult` (`src/hooks/useExpenseAI.ts`) — `{risk_score, radar_dimensions[6], anomalies[], trend_data, uncaptured_savings, executive_summary_markdown}` — **estendido** com `prioridades:[{alerta_id, acao_recomendada: 'investigar'|'cancelar'|'reduzir'|'aceitar', impacto_estimado, justificativa}]` (o `AuditReductionDialog` renderiza quase sem mudança). System prompt orienta: (i) referenciar alertas por `regra_codigo`+`titulo`, nunca inventar suspeita fora dos dados recebidos; (ii) linguagem neutra ("padrão atípico que merece verificação", nunca acusação nominal — o relatório é lido por gestores e pode virar peça de processo); (iii) priorizar por `valor_impacto × severidade`; (iv) apontar explicitamente limitações de dado (bucket sem classificação, gaps ①/②). `[SOFIA_CHART]`/`ChartPayload` (`ContasPagarAIChat.tsx:23-30`) permanece mecanismo do chat, não do relatório. Retrofit das tools da Sofia para as `fn_despesas_*` é melhoria posterior, fora do crítico.

---

## 7. Fila de ação e trilha de auditoria

**Não criar tabela de ações paralela.** A ação vive em `contas_pagar_revisao` (`20251203163804:2-21` — tipo/prioridade/meta/responsável/prazo/status/resultado, RLS `:34-56`) + timeline `revisao_eventos` (`20251203165637:2`) + UI pronta (PlanoReducaoGastos/MarcarRevisaoDialog/RevisaoGastosCard). Mudança mínima: **ALTER no CHECK de `tipo_revisao`** (`:8`) para incluir `'auditar'`. Mapeamento da Torre: cancelar→`eliminar`, reduzir→`reduzir`, auditar/investigar→`auditar`, aceitar como legítimo→descarta o alerta com nota.

**Estados do alerta**: `novo → em_analise → acionado → resolvido | descartado`; `descartado` de qualquer estado com justificativa obrigatória; `acionado` exige criação de `contas_pagar_revisao` via `MarcarRevisaoDialog` e grava `revisao_id` no alerta — a resolução operacional acontece na fila existente; o alerta só rastreia o desfecho.

**Trilha**: transições EXCLUSIVAMENTE por `fn_despesas_alerta_transicao` (§3.2 item 6), que valida o grafo, exige justificativa nos terminais, grava `despesa_alertas_eventos` e chama `audit_log_record(...)` → `audit_log_immutable` (hash chain com seal/block triggers `20260501023237:38,76`; verificação `audit_log_verify_chain :142`). Essencial no contexto: **o próprio descarte de um alerta é evidência** — quem enterrou o alerta fica registrado de forma imutável. Sem policy de UPDATE/DELETE para authenticated em `despesa_alertas`.

**Motor — quem roda e quando**: `fn_despesa_detectar` via pg_cron (padrão idempotente unschedule+schedule, `20260407122217:30-31`): job diário ~07:00 America/Sao_Paulo (`0 10 * * *` UTC) para R02/R03/R04/R07/R09/R12/R13/R14 + R01 do mês corrente; semanal (domingo) para R05/R06/R08/R10/R11/R15; mensal dia 2 fecha o R01 do mês anterior; snapshot `despesa_cp_snapshot` no job mensal. Loop do conector é 30 min (`connector-loop.js:85-93`) — detecção diária pós-madrugada basta e evita flapping. On-demand: `rpc_torre_reprocessar_deteccao()`.

---

## 8. Fases de entrega (cada fase útil sozinha)

**FASE 1 — Torre lê (tela + variações, sem motor).**
- *Lovable (prompt #1)*: (i) RPCs `fn_despesas_departamentos/drill/variacoes` + índices + REVOKE/GRANT; (ii) screenCode/permissão `financeiro_torre_despesas`; (iii) rodar o bloco de prontidão (§9) e colar resultados. *(O antigo item "fix do gap ①" já foi feito em 05/07 — migration `20260705053801` + re-carga verificada.)*
- *Frontend (commit direto, PR draft contra main)*: `TorreDespesas.tsx` + rota/sidebar, header KPIs, banner de qualidade, heatmap, série com bandas, drill 3 níveis, aba "Variações do mês" (fila provisória), botão `MarcarRevisaoDialog` em cada linha (**a ação já funciona na Fase 1** via `contas_pagar_revisao` existente), `SofiaFloatingChat`.
- **Pronto quando**: usuário abre a tela, vê MoM/YoY por departamento com o bucket "(sem classificação)" visível, drill até o título, e marca a primeira despesa para revisão.

**FASE 2 — Motor de alertas + fila com trilha imutável.**
- *Lovable (prompt #2)*: `despesa_regras` (com seed das 15 regras + params) + `despesa_alertas` + `eventos` + `despesa_cp_snapshot` + RLS + `fn_despesa_detectar` + `fn_despesas_alerta_transicao` + `rpc_torre_reprocessar_deteccao` + jobs pg_cron + ALTER CHECK `tipo_revisao` (`'auditar'`). Pré-condição: gap ③ fechado (§10.1).
- *Frontend*: bloco Fila de Alertas (tabs, cards, descartar com justificativa, acionar→MarcarRevisaoDialog→`revisao_id`), KPI "Alertas abertos" real, badge de severidade, botão Reprocessar.
- Pós-merge: pedir aplicação das migrations + smoke test SQL (merge na main NÃO aplica migrations).
- **Pronto quando**: `fn_despesa_detectar` roda sem erro nas 15 regras, re-execução não duplica alertas (upsert), descarte sem justificativa é rejeitado, e a transição aparece em `audit_log_immutable` com chain verificável.

**FASE 3 — Leitura executiva IA.**
- *Lovable (prompt #3)*: `despesa_relatorios_ia` + RLS.
- *Frontend/edge*: `despesas-copilot` (client com JWT do usuário) + painel "Leitura executiva" com `AuditReductionDialog` + histórico; trocar entrada do menu "Visão Departamental"→Torre (aposentar `VisaoDepartamentos.tsx` da navegação, sem apagar).
- **Pronto quando**: relatório do mês gerado, persistido e re-exibido, com `prioridades[]` apontando para `alerta_id` reais.

**FASE 4 — Cobertura, forense e orçado×realizado.**
- *Lovable (prompt #4)*: (i) rodar/agendar `ap_prepare_reclassification_job`/`ap_apply_reclassification_group` (`20260705021146:101-154`, `20260705021432:1-96`) até cobertura de departamento aceitável; (ii) `fn_despesas_orcado_realizado`; (iii) ativar R10 após confirmar cobertura de contratos/orçamento.
- *Conector (droplet)*: **gap ②** — verificar `raw` do staging; se ausente, estender SELECT de `connector-contas-pagar.js:34-57` com o operador do Result + coluna espelho + exibição no drill ("quem lançou"); Progress "gasto vs média" no card de departamento (`DepartmentDetail.tsx:212-215`).
- **Pronto quando**: % de valor sem departamento < 5%, coluna de operador visível no drill, e R10(c) comparando orçado×realizado sem depender de `department_expenses`.

---

## 9. Queries de verificação de prontidão (rodar via prompt Lovable ANTES da Fase 1)

```sql
-- P1. Gap ①: pagos sem data_pagamento (deve zerar após fix+backfill; série do R14 monitora depois)
SELECT count(*) AS quitados_sem_data, sum(valor_pago) AS valor
FROM contas_pagar WHERE valor_aberto=0 AND valor_pago>0 AND data_pagamento IS NULL;

-- P2. Cobertura de departamento_id + peso do fallback do classificador
SELECT count(*) FILTER (WHERE departamento_id IS NULL) AS sem_depto,
       round(100.0*sum(valor_original) FILTER (WHERE departamento_id IS NULL)/sum(valor_original),2) AS pct_valor_sem_depto,
       count(*) FILTER (WHERE departamento_nome='Administrativo' AND coalesce(confianca_classificacao,0)<0.7
                         AND classificacao_manual IS NOT TRUE) AS fallback_admin_baixa_conf
FROM contas_pagar WHERE status <> 'cancelado';

-- P3. Natureza: distribuição e sanidade do CHECK
SELECT natureza_lancamento, count(*), sum(valor_original) FROM contas_pagar GROUP BY 1;

-- P4. Integridade temporal (alimenta R14 e valida eixo data_emissao)
SELECT count(*) FILTER (WHERE data_vencimento < data_emissao) AS venc_antes_emissao,
       count(*) FILTER (WHERE data_pagamento < data_emissao)  AS pgto_antes_emissao,
       count(*) FILTER (WHERE data_emissao IS NULL)           AS sem_emissao,
       min(data_emissao) AS inicio_base, max(data_emissao) AS fim_base
FROM contas_pagar;

-- P5. Cobertura de fornecedor (R02/R03/R05/R06 dependem do código)
SELECT count(*) FILTER (WHERE fornecedor_codigo IS NULL) AS sem_codigo,
       count(DISTINCT fornecedor_codigo) AS fornecedores_distintos
FROM contas_pagar;

-- P6. Cobertura de contratos e orçamento (gate do R10 e da whitelist do R05)
SELECT (SELECT count(*) FROM fornecedor_contratos WHERE tipo='ativo') AS contratos_ativos,
       (SELECT count(*) FROM budget_periods) AS periodos_orcamento,
       (SELECT count(*) FROM budget_distributions) AS distribuicoes;

-- P7. Feriados populados p/ R07 (esperado: anos corrente e anterior)
SELECT extract(year FROM data) AS ano, count(*) FROM feriados GROUP BY 1 ORDER BY 1 DESC LIMIT 3;

-- P8. Trigger de histórico vivo (pré-condição do R09)
SELECT campo_alterado, count(*), max(created_at) AS ultimo
FROM contas_pagar_historico
WHERE campo_alterado IN ('natureza_lancamento','valor_original')
GROUP BY 1;

-- P9. Gap ③: policies de escrita abertas em contas_pagar (esperado: nenhuma USING(true) p/ authenticated)
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy WHERE polrelid = 'public.contas_pagar'::regclass;

-- P10. Gap ②: o raw do staging já traz o operador do Result?
SELECT jsonb_object_keys(raw) AS chave, count(*) FROM erp_contas_pagar_rubysp
WHERE raw IS NOT NULL GROUP BY 1 ORDER BY 1 LIMIT 60;

-- P11. Empresas ativas (esperado: 11) e portador (pré R12)
SELECT count(DISTINCT empresa_id) AS empresas,
       count(*) FILTER (WHERE portador IS NULL) AS sem_portador
FROM contas_pagar;
```

---

## 10. Riscos e decisões em aberto (máx 5)

1. **RLS de escrita aberta em `contas_pagar` (gap ③)** — política original `FOR ALL ... USING(true)` (`20251201053218:116-119`): sob suspeita de fraude, o suspeito pode editar a própria evidência. **Recomendação**: tratar como bloqueante da Fase 2 — escrita só via service_role/RPCs, edição manual restrita a admin com trilha; incluir `planos_reducao` (`20260406153414:12`) na mesma varredura.
2. **Visibilidade dos alertas** — time financeiro inteiro vê a fila, ou só admin/supervisor? Quem lança conta veria alertas sobre as próprias contas. **Recomendação**: Fase 2 nasce restrita a admin/supervisor (+`check_user_access('financeiro')`); ampliar por papel depois que a triagem estiver rodando.
3. **Limiar de alçada do R04 não existe no sistema** (não há tabela de alçadas). **Recomendação**: parâmetro em `despesa_regras.params` (inicial R$10k), calibrado com o financeiro no primeiro mês; documentar o valor vigente no próprio alerta (`evidencia`).
4. **R09 depende da retenção de `contas_pagar_historico`** e só funciona daqui pra frente (natureza existe desde 04/07; o UPDATE do transform sobrescreve in-place). **Recomendação**: criar `despesa_cp_snapshot` mensal já na Fase 2 (mesmo cron) — protege contra limpeza do histórico e habilita provisão-fantasma e lancado-sem-provisão.
5. **Gap ② (operador do ERP)** é a extensão de maior valor forense pendente — sem ela, todas as regras de segregação de função ficam cortadas. **Recomendação**: rodar P10 (§9) primeiro; se o `raw` já tiver o campo (provável `Usuario_tpg`), materializar por transform sem tocar o conector; senão, estender o SELECT (`connector-contas-pagar.js:34-57`) na Fase 4 via droplet.

---

**Arquivos-referência principais**: `supabase/functions/auditoria-contas-pagar/index.ts` (regras absorvidas); `supabase/functions/expense-ai-assistant/index.ts:725-895` (molde IA); `supabase/migrations/20260705042549_0a16c213-9e81-4976-9cd8-e95c076fdf3f.sql` (molde RPC/guard/REVOKE); `20260324015813` (trigger que viabiliza R09); `20260501023237` (audit_log_immutable); `20251203163804`+`20251203165637` (fila de revisão reutilizada); `20260704214256` (transform com gap ①); `20251201053218` (schema base + gap ③); `20260525024912` (fornecedor_contratos); `20260426235810` (feriados); `20260702013001` (molde relatório IA); `connector-rubysp/src/connector-contas-pagar.js` (gap ②); `src/components/financeiro/ContasPagarHeaderKpis.tsx`, `FinanceiroChartsGrid.tsx`, `MarcarRevisaoDialog.tsx`, `AuditReductionDialog.tsx`, `src/hooks/useExpenseAI.ts`, `src/pages/ContasAPagar.tsx:239-281,1704` (padrões de frontend).