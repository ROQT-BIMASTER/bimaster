# ARQUITETURA — ORÇAMENTO CORPORATIVO (ciclo completo: teto → verba → débito → controle)

**Data:** 05/07/2026 · **Status:** desenho aprovado para execução em fases (F0–F4)
**Consolida:** benchmark de processo FP&A + entregável de baseline estatística + inventário do módulo Orçamento + mapa de pontos de débito.
**Documentos irmãos:** `docs/ARQUITETURA-TORRE-CONTROLE-DESPESAS.md` (Torre; R10 reativada aqui), `docs/PROMPT-LOVABLE-ORCAMENTO-CORPORATIVO-FASE0-1.md` (Fase 0/1 aplicada), `docs/PROMPT-LOVABLE-ORCAMENTO-PLANO-DE-CONTAS.md` (Opção A, 0% aplicado — vira F4).
**Regra do repo:** todo objeto de banco desta arquitetura é aplicado via prompt Lovable (MCP pausado); frontend commita direto.

---

## 0. Conflitos entre os desenhos-insumo — resolvidos (1 linha cada)

| # | Conflito | Decisão | Justificativa |
|---|---|---|---|
| C1 | Janela da baseline: 12m (benchmark §2.2) vs 24m fechados (entregável estatístico) | **24 meses fechados** | Índice sazonal exige ≥2 observações por mês-calendário; 12m fica reservado à Torre para DETECÇÃO (`fn_despesas_departamentos`), 24m é CALIBRAÇÃO. |
| C2 | Robustez: mediana/média aparada 20% vs corte p10/p90 | **p10/p90 (`percentile_cont`)** | É a mesma aparagem ~20%, mas determinística e trivial em Postgres; a mediana é devolvida como desempate (se divergir >25% da aparada, usa-se a mediana). |
| C3 | RPC de sugestão: `rpc_sugerir_distribuicao` (benchmark) vs `fn_orcamento_baseline` (entregável) | **Uma única RPC: `fn_orcamento_baseline`** | Já incorpora metas de redução, sazonalidade, bandas e classificação; criar uma segunda função seria duplicar a mesma conta. |
| C4 | Banda de negociação: corredor assimétrico ±σ√N (benchmark) vs bandas ±1σ/±2σ (entregável) | **Bandas ±1σ/±2σ da RPC como cálculo canônico** | Evita duas fórmulas concorrentes; a assimetria pró-corte vira regra de GOVERNANÇA (abaixo da banda inferior = justificar exequibilidade; acima da superior = aprovação nominal da diretoria). |
| C5 | Meta de redução: r(d) + corte pro-rata (benchmark) vs `meta_aplicada = LEAST(0.60, GREATEST(piso global, meta_12m/(12×aparada)))` (entregável) | **Fórmula da RPC** | Já implementa piso global + meta específica de `contas_pagar_revisao` + cap anti-verba-absurda; o corte pro-rata sobrevive como regra de mesa quando Σ propostas > teto (M2/M3). |
| C6 | Nome da função de saldos: `fn_despesas_orcado_realizado` (reservado pela Torre) vs `fn_orcamento_saldos` | **`fn_orcamento_saldos`** | É a implementação concreta do que a Torre reservou (`ARQUITETURA-TORRE:136,228`); uma função só, dois consumidores (R10 e módulo Orçamento) — nunca duas contas do mesmo número. |
| C7 | Índice sazonal: média 24–36m normalizada vs shrinkage `n_anos/(n_anos+1)` + clamp [0,5; 2,0] | **Shrinkage + clamp** | Com 2 observações por mês-calendário o índice bruto é ruído; shrinkage em direção a 1 é obrigatório e defensável. |

---

## 1. Visão

O grupo (11 empresas, em crise financeira com suspeita de fraude) passa a operar sob um **teto de gastos firme**: a diretoria fixa quanto o grupo pode gastar no semestre, o financeiro distribui esse teto em **verbas por departamento**, e cada departamento passa a ter um saldo — como um cartão com limite. Quando uma despesa entra no contas a pagar (provisionada ou lançada no ERP Result, ou aprovada dentro do Huugs), ela **debita automaticamente o saldo da verba do departamento**; quando é paga, vira realizado. O gestor vê o saldo cair em tempo real, é alertado aos 80% e 95% de consumo, e ao atingir 100% as novas despesas internas do departamento são **bloqueadas** até haver suplementação ou remanejamento formal — com justificativa nominal e trilha imutável, porque em contexto de suspeita de fraude o custo do estouro precisa ser visível e assinado, não silencioso.

Os valores das verbas não saem de opinião: saem da **baseline estatística** dos 24 meses de histórico real do contas a pagar (50.987 títulos, 2006→2026) — média robusta que expurga os próprios meses anômalos da crise, ajustada por sazonalidade e cortada pelas metas do plano de redução de gastos. O sistema propõe a verba com banda de tolerância "para mais e para menos" (±1 desvio = alerta, ±2 desvios = investigação — inclusive queda anômala, que em cenário de fraude pode ser despesa migrando de bolso). Sobra de verba **não transporta** entre períodos; aumento de verba só existe como suplementação aprovada com contrapartida. O objetivo de negócio é um só: nenhum real sai do grupo sem ter passado por um teto que alguém aprovou e sem deixar rastro de quem o consumiu.

---

## 2. O processo orçamentário (ciclo, papéis, governança)

### 2.1 Estrutura de períodos
- **Unidade de execução = período SEMESTRAL** em `budget_periods` (tipo `'semestral'` já suportado pelo CHECK, `supabase/migrations/20260625144549_f17febf5-f739-4566-8090-8c023ab3670f.sql:40-53`). O "plano anual" é o PAR S1+S2 aprovado na mesma rodada, cada um com seu `valor_total_empresa` (teto). Não há pai-filho nem versionamento no schema — e não precisa: a revisão semestral é literalmente reabrir/ajustar o S2 em `rascunho` antes de ativá-lo.
- **Mapeamento de status** (enum `budget_period_status` = rascunho|ativo|encerrado, sem 'aprovado' — `20260625142959_080bdb8a...sql:7-17`): `rascunho` = proposta em negociação; `ativo` = aprovado e em execução (**a ativação É o ato de aprovação da diretoria**); `encerrado` = fechado, **saldo remanescente NÃO transporta** (sobra morre no encerramento — regra anti-crise). Gap a fechar na F1: não existe transição de status pela UI (tab Períodos é read-only, `src/pages/financeiro/OrcamentoCorporativo.tsx:83-110`) → RPC `rpc_transicionar_periodo` + botões.
- **Multi-empresa:** as 3 tabelas `budget_*` não têm `empresa_id`. Decisão para a crise: **teto CONSOLIDADO do grupo** num único período (caixa único, gestão centralizada — é o que empresa em recuperação faz); dimensão empresa entra na F4. Workaround interino, se a diretoria exigir: um período por empresa com convenção de nome ("S2-2026 — Union Matriz"), documentado como paliativo.
- **Período-ponte imediato:** "S2-2026 (ponte)" criado via `rpc_criar_periodo_orcamentario` (`20260625144549:265+`) com teto conservador — piloto do processo (2–3 deptos de maior gasto) antes do ciclo cheio 2027.

### 2.2 Quem propõe — híbrido com teto firme
**Top-down no teto + negociação limitada por departamento.** Diretoria fixa o teto (M1); o controller propõe a distribuição por dados via `fn_orcamento_baseline` (M2); o gestor não propõe valor livre — **contesta com evidência** (M3) em jogo soma-zero (ganhar aqui = ceder ali). Bottom-up puro é inviável (0 gestores no backfill — `docs/PROMPT-LOVABLE-ORCAMENTO-CORPORATIVO-FASE0-1.md:135-140`; tela de Perfis nunca construída — hooks órfãos `src/hooks/orcamento/useOrcamentoCorporativo.ts:233-286`; e em crise com suspeita de fraude o histórico é mais confiável que a autodeclaração). Top-down puro também não: sem aceite negociado o gestor não se compromete com a meta de redução. OBZ verdadeiro (justificar linha a linha) aplica-se SÓ aos departamentos que a Torre flagou como anômalos (z-score alto em `fn_despesas_departamentos`) ou classificados `critico` pela baseline.

### 2.3 Calendário (ciclo 2027, com piloto S2-2026 rodando)

| Marco | Quando | O quê | Onde |
|---|---|---|---|
| M0 Baseline | out/2026 (1ªq) | Extrair baseline 24m por depto | `fn_orcamento_baseline` (§4) |
| M1 Teto top-down | out/2026 (2ªq) | Diretoria fixa `valor_total_empresa` de S1-2027 (e S2 indicativo) a partir do plano de caixa da recuperação | `rpc_criar_periodo_orcamentario`; períodos em `rascunho` |
| M2 Distribuição proposta | nov/2026 (1ªq) | Controller propõe verba = baseline − meta (§4.2) | `rpc_distribuir_verba` (`20260625144549:308-391`; versão vigente `20260625155845`); coluna "Sugerido" na `DistribuirVerbaPanel.tsx` |
| M3 Negociação | nov/2026 (2ªq) | Gestor contesta com justificativa; ajustes soma-zero sem elevar o teto; fora da banda ±1σ exige aprovação nominal | reunião + re-execução de `rpc_distribuir_verba` (upsert por UNIQUE period×department, `20260625144549:72-85`) |
| M4 Plano interno | dez/2026 (1ªq) | Gestor abre a verba em linhas (Σ≤alocado garantido por `trg_validar_plano_vs_alocado`, `20260625144549:172-214`) | `PlanoDepartamentoPanel.tsx` |
| M5 Ativação | dez/2026 (2ªq) | Diretoria aprova; S1-2027 → `ativo` | `rpc_transicionar_periodo` + `audit_log_immutable` |
| M6 Execução | mensal, D+5 útil | Rito de variance (§2.5) | `fn_orcamento_saldos` + Torre |
| M7 Corte semestral | jun/2027 | Re-baseline do S2 com os 6 meses realizados, redistribui, aí ativa — **o rolling acontece aqui; o 2º semestre nunca é ativado no escuro** | fluxo M1–M5 comprimido em 3 semanas |
| M8 Encerramento | jan e jul | Período anterior → `encerrado`; saldo não transporta; snapshot final | RPC transição + snapshot mensal (carona no cron da Torre, `ARQUITETURA-TORRE:114-119`) |

### 2.4 Papéis (sobre `department_member_roles`, fundação pronta — `20260625142959:22-30`)

| Papel | Perfil no sistema | Responsabilidade |
|---|---|---|
| **Dono da verba** | `gestor` do depto (`has_dept_role`, `20260625142959:45-57`) | Plano interno (M4), aprovação alçada 1, defesa da variance no rito mensal, pedidos de suplementação/remanejamento |
| **Controller** | `financeiro` global (`is_dept_financeiro`, `20260625142959:59-66`) | Baseline e proposta de distribuição, aceite FPQ (alçada 2), parecer em suplementações, condução do rito, guardião do processo |
| **Diretoria** | admin (passa nas duas funções) | Fixa teto, ativa/encerra períodos, aprova suplementação/remanejamento grande, decide estouros ERP |
| Solicitante/executor | `solicitante`/`executor` | Cria despesas no fluxo existente `department_expenses` → FPQ |

Débito de implantação imediato (F1): **tela Perfis do Departamento** (hooks prontos e órfãos, `useOrcamentoCorporativo.ts:233-286`) + ≥1 gestor por depto; revisar o gate da rota `/dashboard/orcamento` (`src/App.tsx:904` — hoje a rota inteira depende da tela `orcamento_periodos`). Alçada monetária formal não existe no core (decisão aberta #3 da Torre, `ARQUITETURA-TORRE:297`) — precedente pronto no trade (`src/pages/TradeAdminApprovalLevels.tsx`) quando for a hora (ver §8-D4).

### 2.5 Rito mensal (D+5 útil) e trilha
Pauta fixa — real × orçado × baseline:
1. **Painel por depto** (`fn_orcamento_saldos` + Torre): orçado do mês (verba sazonalizada) × comprometido+realizado (`contas_pagar`) × banda baseline. Três leituras: real>orçado mas dentro da banda = meta de redução não está acontecendo (gestão); real fora da banda = anomalia (forense → cruzar com `despesa_alertas`/z-score); real<orçado−1σ = vitória OU despesa sendo empurrada/escondida — investigar igual.
2. Alertas 80/95/100 abertos + estouros ERP não-bloqueáveis (R10c) — gestor responde nominalmente.
3. Suplementações/remanejamentos do mês — leitura das justificativas (transparência entre pares inibe pedido frívolo).
4. **Reclassificações retroativas de departamento** em `contas_pagar` (mudam o débito de bolso depois do fato — `ap_apply_reclassification_group`, `20260705021432:74-88`, trilha em `contas_pagar_historico` `:51-73`): quem, de qual depto para qual, impacto em cada verba. Reclassificação é o vetor mais fácil de esconder estouro — fecha-se por REVISÃO, não por bloqueio.
5. Progresso das metas vs `contas_pagar_revisao`/PlanoReducaoGastos.

Trilha (não negociável dado o contexto de fraude): todo ato orçamentário (criar/ativar/encerrar período, distribuir, suplementar, remanejar, override) → `audit_log_immutable` com justificativa textual obrigatória nos atos que mexem em valor; mutações de `budget_periods`/`budget_distributions` → trigger de histórico campo-a-campo (clone de `trg_contas_pagar_audit`, `20260324015813:19-48` — cardinalidade baixíssima, o veto de performance da §3.3 não se aplica aqui); posição histórica ("saldo na época") = **snapshot mensal** por distribution (carona no cron `despesa_cp_snapshot` da Torre) — imprescindível porque a fn on-the-fly reflete o estado corrente e a reclassificação retroativa reescreve o passado.

---

## 3. Os 3 estágios do dinheiro e o mecanismo de débito

### 3.1 Mapeamento 1:1 com o dado (commitment accounting: empenho→liquidação→pagamento)

| Estágio | Termo | Sinal no dado | Ponto de débito |
|---|---|---|---|
| **ORÇADO** (dotação) | verba | `budget_distributions.valor_alocado` (canônica por dep×período, UNIQUE — `20260625144549:72-85`) | — |
| **COMPROMETIDO** (empenho) | comprometido | `contas_pagar` não-cancelado com `valor_aberto>0` — `natureza_lancamento='provisionado'` (D3) e `'lancado'` (D4) — mais a franja interna D1/D2 ainda sem título | D1–D4 |
| **REALIZADO** (pago) | caixa | `contas_pagar.valor_pago>0` / `data_pagamento` | D5 |
| **ESTORNO** | anulação | `status='cancelado'` (reconciliação de órfãos, preservado pelo trigger `20260319174310:8-23`) — sai automaticamente das somas | D6 |

Pontos do ciclo de vida (do mais cedo ao mais tarde): **D1** `department_expenses.status='approved'` (gestor aprovou — reserva); **D2** FPQ `financial_status='accepted'` + criação do CP `FPQ-*` (compromisso oficial); **D3** provisão ERP; **D4** lançamento ERP; **D5** pagamento; **D6** cancelamento.

**Regra de ouro:** `saldo_disponivel(d,P) = valor_alocado − comprometido(d,P) − realizado(d,P)`. O débito ocorre no **COMPROMETIMENTO** (título entra no CP), não no pagamento — senão o depto estoura o teto meses antes de perceber (um provisionado de R$500k não pago "não existiria" num modelo caixa-only). A decomposição `valor_aberto + valor_pago = valor_original` garante por construção que comprometido e realizado não se duplicam.

### 3.2 Mecanismo escolhido: RPC on-the-fly `fn_orcamento_saldos(p_period_id)` — fonte única de verdade
Molde literal de `fn_cp_dashboard` (`supabase/migrations/20260705042549_0a16c213...sql:6-57`: guard `check_user_access` ERRCODE 42501, `user_has_empresa_access` linha a linha, SECURITY DEFINER + `SET search_path`). Por `budget_distribution` do período devolve:
- `comprometido_erp` = Σ `valor_aberto` de `contas_pagar` não-cancelado com `departamento_id = department_id` e `data_emissao ∈ [data_inicio, data_fim]` (eixo competência já pactuado com a Torre, `ARQUITETURA-TORRE:43`);
- `realizado_erp` = Σ `valor_pago` com `data_pagamento` no período;
- `comprometido_interno` = D1/D2 ainda sem título, com **dedup pela cadeia** `department_expenses.payment_queue_id` → `financial_payment_queue.contas_pagar_id` (item que já virou CP conta só no ERP — impede dupla contagem department_expense→FPQ→contas_pagar);
- bucket `departamento_id IS NULL` exposto como linha **"(sem verba)"** — nunca escondido (é onde gasto não classificado escaparia do controle);
- `consumo_pct = (comprometido+realizado)/valor_alocado` e `saldo_disponivel`.

Custo: agregação sobre ~51k linhas com índices `(departamento_id, data_emissao)` + parcial `WHERE status<>'cancelado'` (`ARQUITETURA-TORRE:122`) = mesma classe do `fn_cp_dashboard`, <100ms. Esta fn **é** a `fn_despesas_orcado_realizado` que a Torre reservou para a R10 (C6).

### 3.3 Justificativa técnica — por que on-the-fly (idempotência com re-sync de 30min é critério ELIMINATÓRIO)
- **(a) Trigger incremental em `contas_pagar` — REJEITADO.** O transform do sync Result reescreve TODAS as ~51k linhas casadas a cada 30 min SEM detecção de mudança (`updated_at=now()` incondicional — `20260705053801:10-38`); um trigger de débito por linha executaria ~2,4M vezes/dia somando-se aos 2 triggers por linha já existentes (`calcular_status_conta_pagar` + `trg_contas_pagar_audit`, `20260324015813:45-48`) dentro do timeout de 180s. Débito incremental exigiria delta OLD→NEW correto sob: valores que mudam no ERP, natureza que flipa provisionado→lancado, `departamento_id` reclassificado em lote retroativamente (`ap_apply_reclassification_group`), cancelamento por reconciliação e re-upsert idempotente — qualquer caso perdido = **drift silencioso do saldo sem fonte de verdade para reconciliar**. Hot-row: todas as linhas de um depto atualizariam a MESMA linha de saldo → serialização de lock no meio do UPDATE em massa.
- **(b) RPC/view on-the-fly — ESCOLHIDO.** Idempotente por construção: o re-sync de 30 min não afeta nada; mudança de valor, cancelamento e reclassificação retroativa são absorvidos automaticamente; fonte única = `contas_pagar` (lição "zero números conflitantes"); é o padrão dominante do sistema (`fn_cp_dashboard`). Limitação honesta: não bloqueia sozinho → §3.5.
- **(c) Ledger alimentado pelo transform — REJEITADO.** O transform não sabe o que mudou (UPDATE cego); diffar é o que `trg_contas_pagar_audit`→`contas_pagar_historico` já faz; um ledger duplicaria o histórico com problema extra de dedup a cada re-sync. "Saldo na época" já é endereçado pelo snapshot mensal (§2.5).
- **Saldo NUNCA materializado em coluna** (`budget_distributions.valor_reservado` fica restrito a reservas do fluxo interno, como concebido na Fase 2 original).

### 3.4 Dois vazamentos a fechar ANTES de ligar o débito (senão o compromisso "some" da verba no momento em que vira oficial)
1. `financial_payment_queue.department_name` é varchar livre SEM FK (`20260204215412_d3d7365e...sql:22`) → adicionar `department_id uuid REFERENCES departamentos(id)`, populado no insert por `useFinancialSubmission` / `useDepartmentExpenses.ts:338`.
2. O CP criado pelo aceite da FPQ nasce SEM `departamento_id`: nem o payload do `acceptPayment` (`src/hooks/useFinancialPaymentQueue.ts:489-502`) nem o `/incluir` da API (`supabase/functions/_shared/contas-pagar/crud-handlers.ts:429-437`) o carregam → propagar (o manual já aceita `p_departamento_id` — `20260320215904:18,47,54`). Idem para título de origem API externa.
3. De carona: reconciliar o CHECK de `source_type` divergente do banco vivo (`20260204215412:9` só permite 4 tipos; o front insere `'department_expense'` — `src/hooks/useFinancialSubmission.ts:7,58,105` — e funciona: constraint alterada fora do versionamento) antes de qualquer migration nessa tabela.

### 3.5 Bloqueio e alerta (o que é bloqueável e o que não é)
- **Bloqueável: só os 2 gates internos**, por validação síncrona contra `fn_orcamento_saldos`: (i) aprovação do gestor em `department_expenses` (`useDepartmentExpenses.ts:216-250`) e (ii) aceite do financeiro na FPQ (`useFinancialPaymentQueue.ts:452-537`). Mecanismo: trigger BEFORE nas tabelas internas de baixa cardinalidade — molde já validado em produção `check_campaign_expense_limit` (`20260123213908:205-236`). NUNCA trigger em `contas_pagar` (§3.3).
- **Não bloqueável: gasto que nasce direto no ERP Result** (o grosso dos 50.987 títulos). Quando o sync o traz, o fato já ocorreu — bloquear seria ficção. Tratamento: alerta R10(c) em `despesa_alertas` com severidade escalando por % de estouro + pauta obrigatória no rito mensal + eventual bloqueio ADMINISTRATIVO (diretoria corta o poder de lançar do depto no Result — decisão humana).
- **No estouro: suplementação com trilha, NÃO hard stop universal.** Folha, tributo e fornecedor crítico não esperam workflow; hard stop só produziria bypass por fora do sistema (mata a rastreabilidade). O custo do estouro é burocrático-visível: justificativa nominal + trilha imutável — é isso que inibe fraude.

---

## 4. Baseline estatística (calibração da verba)

### 4.1 Decisões estatísticas
- **Janela:** 24 meses FECHADOS por competência (`data_emissao`; mês corrente sempre excluído — mês incompleto rebaixa média e infla desvio). Fonte única `contas_pagar` com `status<>'cancelado'` (mesmo filtro das `fn_cp_*`, `20260705042549:28`). Natureza: `provisionado`+`lancado` (provisão é compromisso real); parâmetro `p_natureza` para sensibilidade.
- **2026 (ano de crise) entra CHEIO, mas APARADO:** (i) excluir 2026 E aplicar meta de redução em cima contaria a mesma redução duas vezes → verbas irrealistas que estouram no 1º mês; (ii) os meses-pico (fraude/anomalia) saem pela aparagem sem decisão manual; (iii) a deriva fica VISÍVEL em `tendencia_pct_mes`, que promove o depto a `critico` se crescer ≥5%/mês.
- **Aparagem p10/p90, não ±2σ:** com n=24 e contaminação, o σ é inflado pelos próprios outliers (masking; breakdown point do desvio = 0) — ±2σ não exclui nada exatamente quando mais precisa. p10/p90 é determinístico (~2+2 meses removidos ≈ média aparada 20%).
- **Zero-fill obrigatório** a partir do 1º mês de atividade de cada chave (`generate_series` × chaves; padrão de `fn_despesas_departamentos`, `ARQUITETURA-TORRE:130`) — sem isso, depto que gasta em 6 de 24 meses teria média 4× inflada.
- **Bucket `departamento_id IS NULL`** aparece como "(sem departamento)". A baseline absorve reclassificações retroativas automaticamente (on-the-fly, mesma razão da §3.3-b).

### 4.2 Fórmulas (o entregável-chave)

```
verba_mensal_proposta(d, mês m) = media_aparada(d) × indice_sazonal_norm[m] × (1 − meta_aplicada(d))
verba_anual_proposta(d)         = 12 × media_aparada(d) × (1 − meta_aplicada(d))     [índices somam 12]
banda_alerta       = verba ± 1×desvio    (alimenta a Torre — R10c)
banda_investigacao = verba ± 2×desvio    (investigação forense)
```

- `media_aparada` = `avg(valor) FILTER (valor BETWEEN p10 AND p90)` sobre série zero-filled; `mediana` como desempate (C2); `desvio` = `stddev_samp` CHEIO (a banda deve capturar a variabilidade real, inclusive a dos outliers).
- `indice_sazonal_norm[m]` = média do mês-calendário ÷ média geral, com shrinkage `w = n_anos/(n_anos+1)` em direção a 1, clamp [0,5; 2,0], renormalizado para média 1 (C7).
- `meta_aplicada(d) = LEAST(0.60, GREATEST(p_meta_reducao_pct/100, meta_valor_12m(d)/(12×media_aparada)))` — piso global ("todo mundo corta X%"), meta departamental específica sobrepõe quando maior, cap 60% impede verba absurda/negativa (C5). Fonte das metas: `contas_pagar_revisao` (`20251203163804:2-21`) com `status IN ('pendente','em_andamento')`, `tipo_revisao IN ('eliminar','reduzir','renegociar')` (`monitorar` não corta verba) e `plano_id` → `planos_reducao.status='ativo'`; valor do item = `COALESCE(meta_reducao_valor, valor_atual×meta_reducao_percentual/100)`; item marcado só por plano de contas é rateado aos deptos pelo share de gasto 12m daquele plano.
- **Banda inferior também alerta** ("para menos", pedido explícito): queda >2σ em contexto de fraude pode ser despesa migrando de departamento ou de CNPJ — sinal forense, não economia.
- **Classificação:** `estavel` CV<0,30; `volatil` 0,30≤CV<0,75 (colchão via banda); `critico` se CV≥0,75 OU `meses_com_gasto < min(12, meses/2)` (série intermitente — orçar por evento/projeto) OU `tendencia ≥ +5%/mês` (verba automática é irresponsável — intervenção). Os `critico` são os candidatos a OBZ linha a linha no M3 (§2.2).

### 4.3 RPC `fn_orcamento_baseline` (resumo — SQL completo no Anexo A)
`fn_orcamento_baseline(p_meses=24, p_meta_reducao_pct=0, p_empresa_ids=NULL, p_departamento=NULL, p_natureza=NULL, p_incluir_sem_depto=true) RETURNS jsonb` — SECURITY DEFINER, guard `check_user_access('financeiro')`, `user_has_empresa_access` por linha (molde `fn_cp_dashboard`). Grão: departamento (default) ou drill dep×plano de contas (`p_departamento` preenchido). Devolve por chave: `media_mensal`, `mediana`, `media_aparada`, `p10/p90`, `desvio`, `cv`, `tendencia_pct_mes`, `indices_sazonais[12]`, `meta_reducao_aplicada_pct`, `verba_mensal/anual_proposta`, `verba_por_mes[12]`, bandas ±1σ/±2σ e `classificacao`. **Read-only** — não escreve em `budget_distributions`: a tela chama a RPC, pré-preenche a grid da `DistribuirVerbaPanel.tsx`, o financeiro ajusta e salva via `rpc_distribuir_verba` (que já valida Σ≤teto sob lock, `20260625144549:308-391`). Não substitui `fn_despesas_departamentos` (Torre = DETECÇÃO 12m; esta = CALIBRAÇÃO 24m) — as duas convergem quando as bandas ±kσ daqui alimentarem a R10(c) → `despesa_alertas`.

---

## 5. Modelo de dados

### 5.1 REUSA (bom e pronto — não tocar)
- `budget_periods` + `budget_distributions` (`20260625144549:40-85`): teto (`valor_total_empresa`), verba canônica (`valor_alocado`, UNIQUE period×department), locks anti-estouro nas RPCs e no `trg_validar_plano_vs_alocado` (`:172-214`).
- `department_member_roles` + `has_dept_role`/`is_dept_financeiro` (`20260625142959:22-66`): fundação de papéis, já refatorada nas RLS.
- `rpc_criar_periodo_orcamentario`, `rpc_distribuir_verba` (versão `20260625155845`), `rpc_atribuir_perfil_departamento`.
- `contas_pagar` como fonte única de comprometido/realizado; `contas_pagar_revisao`/`planos_reducao` como fonte de metas; `despesa_alertas` como fila de alertas (Torre); `audit_log_immutable` + padrão `trg_contas_pagar_audit` (`20260324015813:19-48`); cron de snapshot da Torre.
- `financial_payment_queue` como evento de "aprovado p/ pagamento" dos gastos internos (fluxo aceite→export ERP→baixa funciona).
- `vw_budget_distribution_kpis` **como CONTRATO** (nomes `valor_utilizado/valor_comprometido/saldo_livre`) — ver 5.2.

### 5.2 ALTERA

| Objeto | Mudança | Fase |
|---|---|---|
| `financial_payment_queue` | `+ department_id uuid REFERENCES departamentos(id)` (backfill por `department_name`); reconciliar CHECK `source_type` (divergência viva — `20260204215412:9` vs `useFinancialSubmission.ts:7,58,105`) | F2 |
| `/incluir` da contas-pagar-api | aceitar/propagar `departamento_id` (`crud-handlers.ts:429-437`) | F2 |
| `vw_budget_distribution_kpis` | trocar as ENTRANHAS para `fn_orcamento_saldos` mantendo o contrato — hoje está duplamente quebrada: `valor_comprometido=0` hardcoded (`20260625144549:238`) e `valor_utilizado` vem de `department_expenses` com `distribution_id` nunca populado (estruturalmente zero, `:252-260`) | F2 |
| `useBudgetKpis` | remover casts `as never` obsoletos (`useOrcamentoCorporativo.ts:220-222`; tipo já existe em `src/integrations/supabase/types.ts:54408`) | F2 |
| `budget_plan_categories.categoria_id` | Opção A: apontar para conta orçamentária de `trade_chart_of_accounts` (flag `orcamentavel` + rollup `conta_orcamentaria_de()`), aposentando `orcamento_categorias` — sem isso o orçado×realizado só desce a departamento; com isso desce a conta, que é onde a fraude se esconde (`docs/PROMPT-LOVABLE-ORCAMENTO-PLANO-DE-CONTAS.md`, 0% aplicado) | F4 |
| `budget_periods`/`budget_distributions` | `+ empresa_id` (teto por empresa) | F4 |

### 5.3 CRIA (DDL/assinaturas resumidas)

```sql
-- F0
CREATE FUNCTION fn_orcamento_baseline(p_meses int, p_meta_reducao_pct numeric,
  p_empresa_ids int[], p_departamento uuid, p_natureza text, p_incluir_sem_depto bool)
  RETURNS jsonb;                                   -- Anexo A (completa)
CREATE INDEX IF NOT EXISTS idx_cp_dep_emissao ON contas_pagar (departamento_id, data_emissao);
CREATE INDEX IF NOT EXISTS idx_cp_emissao_ativos ON contas_pagar (data_emissao) WHERE status <> 'cancelado';

-- F1
CREATE FUNCTION rpc_transicionar_periodo(p_period_id uuid, p_novo_status budget_period_status,
  p_justificativa text) RETURNS void;              -- rascunho→ativo só financeiro/diretoria;
                                                   -- ativo→encerrado exige data≥data_fim; grava audit_log_immutable

-- F2
CREATE FUNCTION fn_orcamento_saldos(p_period_id uuid) RETURNS jsonb;
  -- por distribution: valor_alocado, comprometido_erp (Σ valor_aberto, dep+janela),
  -- realizado_erp (Σ valor_pago por data_pagamento), comprometido_interno (D1/D2 dedup),
  -- saldo_disponivel, consumo_pct + linha "(sem verba)". Molde fn_cp_dashboard.

-- F3
CREATE FUNCTION rpc_suplementar_verba(p_distribution_id uuid, p_valor numeric,
  p_justificativa text, p_contrapartida_distribution_id uuid DEFAULT NULL) RETURNS void;
  -- invariante: sem contrapartida, exige elevação formal de valor_total_empresa no MESMO ato (Σ≤teto sempre);
  -- mesmo mecanismo com sinal negativo em lote = contingenciamento (freio de emergência da diretoria)
CREATE FUNCTION rpc_remanejar_verba(p_period_id uuid, p_dept_origem uuid, p_dept_destino uuid,
  p_valor numeric, p_justificativa text) RETURNS void;
  -- lock nas duas distributions em ordem consistente (precedente 20260625144549:305-307);
  -- valida saldo DISPONÍVEL do origem via fn_orcamento_saldos (não o alocado bruto)
CREATE TRIGGER trg_budget_audit ...              -- clone campo-a-campo de trg_contas_pagar_audit
  ON budget_periods / budget_distributions;
CREATE TRIGGER trg_bloqueio_verba BEFORE UPDATE  -- molde check_campaign_expense_limit (20260123213908:205-236)
  ON department_expenses / financial_payment_queue; -- nega aprovação/aceite se estoura saldo (consumo≥100%)
CREATE TABLE orcamento_saldo_snapshot (           -- carona no cron despesa_cp_snapshot da Torre
  distribution_id uuid, competencia date, valor_alocado numeric,
  comprometido numeric, realizado numeric, snapshot_em timestamptz DEFAULT now(),
  UNIQUE (distribution_id, competencia));
```

### 5.4 Alertas de estouro — integração com a Torre (R10 reativada)
A regra **R10 (orçado×realizado)**, adiada na Torre esperando exatamente esta base (`ARQUITETURA-TORRE:157,228`), é reativada em degraus sobre `consumo_pct` de `fn_orcamento_saldos`, gravando em `despesa_alertas` (fila forense existente):

| Degrau | Gatilho | Ação | Severidade |
|---|---|---|---|
| 🟡 80% | consumo ≥80% com >20% do período restante | alerta gestor + controller | média |
| 🟠 95% | consumo ≥95% | alerta diretoria; despesas internas do depto exigem carimbo do financeiro mesmo abaixo de alçada; plano de pouso no rito | alta |
| 🔴 100% | consumo ≥100% | bloqueio dos 2 gates internos + abertura obrigatória de suplementação/remanejamento; estouro vindo do ERP = alerta R10(c) escalando por % (não bloqueável) | crítica |

As bandas ±1σ/±2σ da baseline (§4.2) alimentam a mesma R10(c) — inclusive banda INFERIOR (queda anômala = sinal forense).

---

## 6. Telas (preservar visual, trocar só a origem — nunca redesenhar)

- **`src/pages/financeiro/OrcamentoCorporativo.tsx`** (seletor de período + 3 tabs, `:39-136`):
  - Tab Períodos (`:83-110`, read-only): + botões Ativar/Encerrar chamando `rpc_transicionar_periodo` (F1). Nenhuma mudança de layout — ações na linha da tabela existente.
  - + Header de KPI cards no padrão `*KPICards.tsx` já previsto no prompt original (`PROMPT-LOVABLE-ORCAMENTO-CORPORATIVO-FASE0-1.md:254-255`), alimentado por `fn_orcamento_saldos` (F2).
  - + Tab/tela **Perfis do Departamento** (item 2.9 do prompt original, `:256-261`) consumindo os hooks órfãos `useOrcamentoCorporativo.ts:233-286` (F1).
  - Fix do gate: rota `/dashboard/orcamento` inteira depende da tela `orcamento_periodos` (`src/App.tsx:904`) — gestor precisa enxergar a aba Plano sem herdar as demais (F1).
- **`src/components/orcamento/DistribuirVerbaPanel.tsx`** (grid departamento×valor em branco, `:26-37` — hoje o controller digita às cegas): + coluna **"Sugerido (baseline − meta)"** com tooltip {baseline, sazonalidade, meta aplicada, banda ±1σ} e badge de classificação, via `fn_orcamento_baseline` (F0 — é a ligação baseline↔orçamento que hoje é zero). Totalizador Distribuído/Restante (`:52-58`) intocado. Ações de suplementação/remanejamento entram AQUI (F3) — sem UI nova.
- **`src/components/orcamento/PlanoDepartamentoPanel.tsx`**: zero retoque visual — continua consumindo `useBudgetKpis` (`:64`); os números passam a vir de `contas_pagar` quando a view trocar as entranhas (F2).
- **Torre de Controle / tela CP — widget "Saldo de verba"**: card por departamento no visual existente da Torre (`src/hooks/financeiro/useTorreDespesas.ts` como referência de consumo) mostrando alocado × comprometido × realizado × saldo + farol 80/95/100, via `fn_orcamento_saldos` (F2). Regra da lição da Fase A da tela CP: **zero números de duas origens na mesma tela** — o widget usa exclusivamente a fn.
- **Hubs de aprovação** (`DepartmentApprovalHub.tsx`, FPQ): exibir saldo da verba do depto ao lado do item + mensagem clara quando o bloqueio 🔴 negar aprovação (F3).

---

## 7. Fases de entrega

| Fase | Entrega | Lovable (banco, via prompt) | Frontend (commit direto) | Critério de pronto |
|---|---|---|---|---|
| **F0 — Baseline estatística** (só leitura, valor imediato) | verba sugerida por depto com bandas | `fn_orcamento_baseline` (Anexo A) + 2 índices; rodar V1–V3 | coluna "Sugerido" + badge na `DistribuirVerbaPanel.tsx` | RPC devolve itens p/ todos os deptos; V1 com razão 85–105% (ou desvio explicado); grid pré-preenchida |
| **F1 — Estrutura + distribuição** | governança operável + piloto | `rpc_transicionar_periodo`; reconciliar CHECK `source_type` da FPQ | tela Perfis (hooks prontos); botões Ativar/Encerrar; fix gate `App.tsx:904` | ≥1 gestor/depto em `department_member_roles`; período-ponte "S2-2026" `ativo` com Σ≤teto; transição gravada em `audit_log_immutable` |
| **F2 — Débito automático + saldos** | saldo em tempo real debitado por `contas_pagar` | `financial_payment_queue.department_id` FK + backfill; `fn_orcamento_saldos`; reescrever entranhas da `vw_budget_distribution_kpis`; `/incluir` propaga `departamento_id` | payload `acceptPayment` + inserts FPQ carregam `department_id`; limpar casts `as never`; widget de saldo na Torre/CP; KPI header | saldo da UI = V4; título FPQ→CP nasce COM `departamento_id`; bucket "(sem verba)" visível; V5 sem órfãos inexplicados |
| **F3 — Alertas de estouro + suplementação com trilha** | teto com dentes | degraus 80/95/100 → `despesa_alertas` (R10 reativada); triggers BEFORE de bloqueio nos 2 gates; `rpc_suplementar_verba` + `rpc_remanejar_verba`; `trg_budget_audit`; `orcamento_saldo_snapshot` no cron | alertas nos hubs; mensagens de bloqueio; ações de suplementação/remanejamento na `DistribuirVerbaPanel` | teste sintético dispara cada degrau; aprovação que estoura é NEGADA; suplementação sem contrapartida exige elevar teto no mesmo ato; tudo com justificativa em `audit_log_immutable`; 1º snapshot gravado |
| **F4 — Rolling forecast + profundidade** | ciclo 2027 completo | Opção A plano de contas (`PROMPT-LOVABLE-ORCAMENTO-PLANO-DE-CONTAS.md`); `empresa_id` em `budget_*`; contingenciamento em lote; `budget_requests` (Fase 2 original — `valor_reservado`) | orçado×realizado por conta na aba Plano; comparativo "baseline nova × verba vigente" p/ o rito M7 | S2-2027 só ativa após re-baseline com 6m realizados (M7); drill por conta funciona; teto por empresa disponível |

Dependências duras: F2 depende dos itens 1–3 da §3.4 (encanamento) — ligar débito antes deles faz o compromisso interno "sumir" da verba; F3 depende de F2 (bloqueio valida contra `fn_orcamento_saldos`); F0 e F1 são independentes entre si e podem correr em paralelo.

---

## 8. Decisões em aberto (máx. 5)

| # | Decisão | Recomendação |
|---|---|---|
| D1 | `meta_reducao_valor`/`valor_atual` de `contas_pagar_revisao` são ANUALIZADOS ou mensais? | Tratar como anualizados (como está na RPC); confirmar com o time do plano de redução — se mensais, remover o `12.0 *` no denominador de `meta_aplicada` (1 linha). |
| D2 | FK `contas_pagar.plano_contas_id → trade_chart_of_accounts` (presumida pela FK homóloga de `contas_pagar_revisao`, `20251203163804:5`) | Confirmar via prompt Lovable antes de aplicar a F0 (afeta só o rótulo do drill dep×plano). |
| D3 | Teto consolidado do grupo vs teto por empresa (sem `empresa_id` hoje) | Consolidado até F4 (caixa único é o modo recuperação); se a diretoria exigir antes, período por empresa com convenção de nome, documentado como paliativo. |
| D4 | Alçada monetária formal por valor (decisão aberta #3 da Torre, `ARQUITETURA-TORRE:297`) | Adiar para depois de F3; quando vier, clonar o precedente `TradeAdminApprovalLevels.tsx` — o degrau 🟠 95% (carimbo do financeiro) já cobre o interino. |
| D5 | Comportamento no 🔴 100% dos gates internos: hard stop absoluto vs bloqueio com válvula | Bloqueio com válvula única = suplementação/remanejamento formal (nunca override individual por despesa); hard stop absoluto geraria bypass por fora do sistema e mataria a trilha. |

---

## 9. Queries de validação (rodar no Lovable direto no SQL — NÃO chamar as RPCs no editor: `auth.uid()` é NULL lá e o guard levanta 42501; as queries replicam o núcleo sem os guards)

**V1 — Coerência global: baseline aparada anualizada vs realizado 12m (esperado: razão 85–105%)**
```sql
WITH j AS (SELECT (date_trunc('month',current_date) - interval '24 months')::date ini,
                  (date_trunc('month',current_date) - interval '1 month')::date  fim),
s AS (SELECT cp.departamento_id d, date_trunc('month',cp.data_emissao)::date mes, sum(cp.valor_original) v
      FROM contas_pagar cp, j WHERE cp.status<>'cancelado'
        AND cp.data_emissao >= j.ini AND cp.data_emissao < (j.fim + interval '1 month')::date
      GROUP BY 1,2),
zf AS (SELECT dd.d, m.mes, COALESCE(s.v,0)::numeric v
       FROM (SELECT DISTINCT d FROM s) dd
       CROSS JOIN (SELECT gs::date mes FROM j, generate_series(j.ini,j.fim,interval '1 month') gs) m
       LEFT JOIN s ON s.d IS NOT DISTINCT FROM dd.d AND s.mes = m.mes),
q AS (SELECT d, percentile_cont(0.10) WITHIN GROUP (ORDER BY v) p10,
              percentile_cont(0.90) WITHIN GROUP (ORDER BY v) p90 FROM zf GROUP BY d),
b AS (SELECT zf.d, avg(zf.v) FILTER (WHERE zf.v BETWEEN q.p10 AND q.p90) ma
      FROM zf JOIN q USING (d) GROUP BY zf.d, q.p10, q.p90),
r12 AS (SELECT sum(cp.valor_original) g FROM contas_pagar cp, j
        WHERE cp.status<>'cancelado'
          AND cp.data_emissao >= (j.fim - interval '11 months')::date
          AND cp.data_emissao <  (j.fim + interval '1 month')::date)
SELECT round(sum(b.ma)*12,2)                              AS baseline_anual_grupo,
       (SELECT round(g,2) FROM r12)                       AS realizado_12m,
       round(100.0*sum(b.ma)*12/NULLIF((SELECT g FROM r12),0),1) AS razao_pct
FROM b;
```
Interpretação: <85% = aparagem cortando demais (crise concentrada — ver V2) ou gasto acelerando; >105% = gasto recente já caiu abaixo da média 24m (plano de redução surtindo efeito) — baseline conservadora, ok para teto.

**V2 — Top-5 departamentos por CV + classificação (piso R$10k/mês p/ não ranquear ruído)**
```sql
WITH j AS (SELECT (date_trunc('month',current_date) - interval '24 months')::date ini,
                  (date_trunc('month',current_date) - interval '1 month')::date  fim),
s AS (SELECT cp.departamento_id d, date_trunc('month',cp.data_emissao)::date mes, sum(cp.valor_original) v
      FROM contas_pagar cp, j WHERE cp.status<>'cancelado'
        AND cp.data_emissao >= j.ini AND cp.data_emissao < (j.fim + interval '1 month')::date GROUP BY 1,2),
zf AS (SELECT dd.d, m.mes, COALESCE(s.v,0)::numeric v
       FROM (SELECT DISTINCT d FROM s) dd
       CROSS JOIN (SELECT gs::date mes FROM j, generate_series(j.ini,j.fim,interval '1 month') gs) m
       LEFT JOIN s ON s.d IS NOT DISTINCT FROM dd.d AND s.mes = m.mes),
st AS (SELECT d, avg(v) media, stddev_samp(v) desvio,
              count(*) FILTER (WHERE v>0) meses_gasto FROM zf GROUP BY d)
SELECT COALESCE(dep.nome,'(sem departamento)') departamento,
       round(st.media,2) media_mensal, round(st.desvio,2) desvio,
       round(st.desvio/NULLIF(st.media,0),3) cv, st.meses_gasto,
       CASE WHEN st.meses_gasto<12 OR st.desvio/NULLIF(st.media,0)>=0.75 THEN 'critico'
            WHEN st.desvio/NULLIF(st.media,0)>=0.30 THEN 'volatil' ELSE 'estavel' END classificacao
FROM st LEFT JOIN departamentos dep ON dep.id = st.d
WHERE st.media >= 10000
ORDER BY st.desvio/NULLIF(st.media,0) DESC NULLS LAST
LIMIT 5;
```
Interpretação: top-CV = candidatos a verba com colchão/aprovação por item; departamento GRANDE (média >R$500k) aqui é red flag forense (gasto grande não deveria ser errático) — cruzar com `despesa_alertas` R01.

**V3 — Efeito da meta global de 10% + metas específicas de `contas_pagar_revisao`**
```sql
WITH j AS (SELECT (date_trunc('month',current_date) - interval '24 months')::date ini,
                  (date_trunc('month',current_date) - interval '1 month')::date  fim),
s AS (SELECT cp.departamento_id d, date_trunc('month',cp.data_emissao)::date mes, sum(cp.valor_original) v
      FROM contas_pagar cp, j WHERE cp.status<>'cancelado'
        AND cp.data_emissao >= j.ini AND cp.data_emissao < (j.fim + interval '1 month')::date GROUP BY 1,2),
zf AS (SELECT dd.d, m.mes, COALESCE(s.v,0)::numeric v
       FROM (SELECT DISTINCT d FROM s) dd
       CROSS JOIN (SELECT gs::date mes FROM j, generate_series(j.ini,j.fim,interval '1 month') gs) m
       LEFT JOIN s ON s.d IS NOT DISTINCT FROM dd.d AND s.mes = m.mes),
q AS (SELECT d, percentile_cont(0.10) WITHIN GROUP (ORDER BY v) p10,
              percentile_cont(0.90) WITHIN GROUP (ORDER BY v) p90 FROM zf GROUP BY d),
b AS (SELECT zf.d, avg(zf.v) FILTER (WHERE zf.v BETWEEN q.p10 AND q.p90) ma
      FROM zf JOIN q USING (d) GROUP BY zf.d, q.p10, q.p90),
mt AS (SELECT r.departamento_id d,
              sum(COALESCE(r.meta_reducao_valor, r.valor_atual*r.meta_reducao_percentual/100.0,0)) mv
       FROM contas_pagar_revisao r LEFT JOIN planos_reducao pr ON pr.id=r.plano_id
       WHERE r.status IN ('pendente','em_andamento')
         AND r.tipo_revisao IN ('eliminar','reduzir','renegociar')
         AND (r.plano_id IS NULL OR pr.status='ativo') AND r.departamento_id IS NOT NULL
       GROUP BY 1)
SELECT COALESCE(dep.nome,'(sem departamento)') departamento,
       round(12*b.ma,2) baseline_anual,
       round(100*LEAST(0.60,GREATEST(0.10,COALESCE(mt.mv,0)/NULLIF(12*b.ma,0))),1) meta_pct,
       round(12*b.ma*(1-LEAST(0.60,GREATEST(0.10,COALESCE(mt.mv,0)/NULLIF(12*b.ma,0)))),2) verba_anual,
       round(12*b.ma*LEAST(0.60,GREATEST(0.10,COALESCE(mt.mv,0)/NULLIF(12*b.ma,0))),2) economia_anual
FROM b LEFT JOIN mt ON mt.d IS NOT DISTINCT FROM b.d
LEFT JOIN departamentos dep ON dep.id = b.d
ORDER BY baseline_anual DESC;
```
Interpretação: `economia_anual` total ≥10% do baseline (exato p/ deptos sem meta própria; mais nos que têm). Depto batendo no cap de 60% = meta cadastrada anualizada errado ou irrealista — revisar o item (e a decisão D1).

**V4 — Núcleo do `fn_orcamento_saldos` p/ um período (substituir :ini/:fim pelas datas do período; comparar com a UI após F2)**
```sql
SELECT COALESCE(dep.nome,'(sem verba)') departamento,
       round(sum(cp.valor_aberto) FILTER (WHERE cp.data_emissao BETWEEN :ini AND :fim), 2)   comprometido_erp,
       round(sum(cp.valor_pago)  FILTER (WHERE cp.data_pagamento BETWEEN :ini AND :fim), 2)  realizado_erp
FROM contas_pagar cp
LEFT JOIN departamentos dep ON dep.id = cp.departamento_id
WHERE cp.status <> 'cancelado'
GROUP BY 1
ORDER BY 2 DESC NULLS LAST;
```
Interpretação: por depto, `comprometido+realizado` deve bater com o card da UI (F2) e a soma da linha "(sem verba)" deve tender a zero conforme a reclassificação avança — se crescer, a classificação pós-carga está regredindo.

**V5 — Franja interna (D1/D2) e dedup da cadeia (pós-F2; `department_id` só existe após a migration)**
```sql
SELECT
 (SELECT count(*) FROM financial_payment_queue
   WHERE financial_status IN ('pending','accepted') AND contas_pagar_id IS NULL)               fpq_sem_cp,     -- conta como comprometido_interno
 (SELECT count(*) FROM financial_payment_queue
   WHERE financial_status = 'accepted' AND contas_pagar_id IS NOT NULL)                        fpq_com_cp,     -- já conta no ERP: NÃO somar de novo
 (SELECT count(*) FROM department_expenses
   WHERE status IN ('approved','pending_financial') AND payment_queue_id IS NULL)              de_sem_fpq,     -- D1 puro
 (SELECT count(*) FROM financial_payment_queue
   WHERE department_id IS NULL AND financial_status IN ('pending','accepted'))                 fpq_sem_depto;  -- deve ser 0 após backfill
```
Interpretação: `fpq_sem_depto > 0` após o backfill = insert que não propaga o departamento (regressão no encanamento da §3.4); `fpq_com_cp` cresce e `fpq_sem_cp` gira — se `fpq_sem_cp` acumular, o vínculo `contas_pagar_id` no aceite quebrou (dupla contagem à vista).

---

## Anexo A — SQL completo da `fn_orcamento_baseline` (aplicar via prompt Lovable; molde de segurança literal de `fn_cp_dashboard`, `20260705042549:6-57`)

```sql
-- =========================================================================
-- fn_orcamento_baseline — baseline estatística p/ calibrar budget_distributions
-- Grão: departamento (p_departamento NULL) ou plano de contas dentro de um
-- departamento (drill). Janela: p_meses fechados, eixo data_emissao.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fn_orcamento_baseline(
  p_meses             int       DEFAULT 24,
  p_meta_reducao_pct  numeric   DEFAULT 0,      -- piso GLOBAL em % (10 = 10%)
  p_empresa_ids       integer[] DEFAULT NULL,
  p_departamento      uuid      DEFAULT NULL,   -- NULL = grão depto; senão drill dep×plano
  p_natureza          text      DEFAULT NULL,   -- 'provisionado'|'lancado'|NULL
  p_incluir_sem_depto boolean   DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mes_fim  date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_mes_ini  date;
  v_cap_meta numeric := 0.60;   -- teto de redução aplicável
BEGIN
  IF NOT public.check_user_access(auth.uid(), 'financeiro') THEN
    RAISE EXCEPTION 'acesso negado: modulo financeiro' USING ERRCODE = '42501';
  END IF;

  p_meses  := GREATEST(COALESCE(p_meses, 24), 12);   -- sazonalidade exige >= 12
  v_mes_ini := (v_mes_fim - make_interval(months => p_meses - 1))::date;

  RETURN (
  WITH base AS (
    SELECT CASE WHEN p_departamento IS NULL THEN cp.departamento_id
                ELSE cp.plano_contas_id END           AS chave,
           date_trunc('month', cp.data_emissao)::date AS mes,
           cp.valor_original
    FROM public.contas_pagar cp
    WHERE cp.status <> 'cancelado'
      AND cp.data_emissao >= v_mes_ini
      AND cp.data_emissao <  (v_mes_fim + interval '1 month')::date
      AND public.user_has_empresa_access(auth.uid(), cp.empresa_id)
      AND (p_empresa_ids  IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
      AND (p_natureza     IS NULL OR cp.natureza_lancamento = p_natureza)
      AND (p_departamento IS NULL OR cp.departamento_id = p_departamento)
      AND (p_incluir_sem_depto OR cp.departamento_id IS NOT NULL)
  ),
  chaves AS (SELECT chave, min(mes) AS primeiro_mes FROM base GROUP BY chave),
  meses  AS (
    SELECT gs::date AS mes, (row_number() OVER (ORDER BY gs))::numeric - 1 AS idx
    FROM generate_series(v_mes_ini, v_mes_fim, interval '1 month') gs
  ),
  serie AS (                       -- grade zero-filled a partir da 1ª atividade
    SELECT c.chave, m.mes, m.idx, COALESCE(sum(b.valor_original), 0)::numeric AS valor
    FROM chaves c
    JOIN meses m ON m.mes >= c.primeiro_mes
    LEFT JOIN base b ON b.chave IS NOT DISTINCT FROM c.chave AND b.mes = m.mes
    GROUP BY c.chave, m.mes, m.idx
  ),
  quantis AS (
    SELECT chave,
           percentile_cont(0.5)  WITHIN GROUP (ORDER BY valor) AS mediana,
           percentile_cont(0.10) WITHIN GROUP (ORDER BY valor) AS p10,
           percentile_cont(0.90) WITHIN GROUP (ORDER BY valor) AS p90
    FROM serie GROUP BY chave
  ),
  stats AS (
    SELECT s.chave,
           count(*)::int                                 AS n_meses,
           count(*) FILTER (WHERE s.valor > 0)::int      AS meses_com_gasto,
           avg(s.valor)                                  AS media_mensal,
           COALESCE(stddev_samp(s.valor), 0)             AS desvio,
           q.mediana, q.p10, q.p90,
           COALESCE(avg(s.valor) FILTER (WHERE s.valor BETWEEN q.p10 AND q.p90),
                    q.mediana)::numeric                  AS media_aparada,
           count(*) FILTER (WHERE s.valor < q.p10 OR s.valor > q.p90)::int AS meses_aparados,
           COALESCE(regr_slope(s.valor, s.idx), 0)       AS slope
    FROM serie s JOIN quantis q USING (chave)
    GROUP BY s.chave, q.mediana, q.p10, q.p90
  ),
  saz AS (   -- índice bruto -> shrink n_anos/(n_anos+1) -> clamp [0.5, 2.0]
    SELECT r.chave, r.mes_cal,
           LEAST(2.0, GREATEST(0.5,
             1 + (COALESCE(r.media_mes_cal / NULLIF(st.media_mensal, 0), 1) - 1)
                 * ((p_meses/12.0) / (p_meses/12.0 + 1)))) AS idx_clamp
    FROM (SELECT chave, extract(month FROM mes)::int AS mes_cal, avg(valor) AS media_mes_cal
          FROM serie GROUP BY 1, 2) r
    JOIN stats st USING (chave)
  ),
  saz12 AS ( -- completa 12 meses-calendário (ausente = 1)
    SELECT c.chave, gs.mes_cal, COALESCE(s.idx_clamp, 1)::numeric AS idx_c
    FROM chaves c
    CROSS JOIN (SELECT generate_series(1, 12) AS mes_cal) gs
    LEFT JOIN saz s ON s.chave IS NOT DISTINCT FROM c.chave AND s.mes_cal = gs.mes_cal
  ),
  saz_norm AS ( -- renormaliza p/ média 1 => soma dos 12 meses = 12 x verba base
    SELECT chave, mes_cal,
           idx_c / NULLIF(avg(idx_c) OVER (PARTITION BY chave), 0) AS indice
    FROM saz12
  ),
  -- ------- metas de redução (contas_pagar_revisao + planos_reducao) -------
  metas_itens AS (
    SELECT r.departamento_id, r.plano_contas_id,
           COALESCE(r.meta_reducao_valor,
                    r.valor_atual * r.meta_reducao_percentual / 100.0, 0) AS meta_valor
    FROM public.contas_pagar_revisao r
    LEFT JOIN public.planos_reducao pr ON pr.id = r.plano_id
    WHERE r.status IN ('pendente', 'em_andamento')
      AND r.tipo_revisao IN ('eliminar', 'reduzir', 'renegociar')  -- 'monitorar' não corta verba
      AND (r.plano_id IS NULL OR pr.status = 'ativo')
  ),
  gasto12 AS (  -- 12m fechados p/ ratear metas nível-plano no grão departamento
    SELECT cp.departamento_id, cp.plano_contas_id, sum(cp.valor_original) AS v12
    FROM public.contas_pagar cp
    WHERE cp.status <> 'cancelado'
      AND cp.data_emissao >= (v_mes_fim - interval '11 months')::date
      AND cp.data_emissao <  (v_mes_fim + interval '1 month')::date
      AND public.user_has_empresa_access(auth.uid(), cp.empresa_id)
      AND (p_empresa_ids IS NULL OR cp.empresa_id = ANY(p_empresa_ids))
    GROUP BY 1, 2
  ),
  meta_direta AS (
    SELECT CASE WHEN p_departamento IS NULL THEN mi.departamento_id
                ELSE mi.plano_contas_id END AS chave,
           sum(mi.meta_valor) AS meta_valor
    FROM metas_itens mi
    WHERE (p_departamento IS NULL AND mi.departamento_id IS NOT NULL)
       OR (p_departamento IS NOT NULL AND mi.plano_contas_id IS NOT NULL
           AND (mi.departamento_id = p_departamento OR mi.departamento_id IS NULL))
    GROUP BY 1
  ),
  meta_rateada AS (  -- meta marcada só por plano -> rateia pelo share 12m do depto
    SELECT g.departamento_id AS chave,
           sum(mi.meta_valor * g.v12 / NULLIF(t.v12_plano, 0)) AS meta_valor
    FROM metas_itens mi
    JOIN (SELECT plano_contas_id, sum(v12) AS v12_plano FROM gasto12 GROUP BY 1) t
      ON t.plano_contas_id = mi.plano_contas_id
    JOIN gasto12 g ON g.plano_contas_id = mi.plano_contas_id
    WHERE p_departamento IS NULL
      AND mi.departamento_id IS NULL AND mi.plano_contas_id IS NOT NULL
    GROUP BY 1
  ),
  metas AS (
    SELECT COALESCE(d.chave, r.chave) AS chave,
           COALESCE(d.meta_valor, 0) + COALESCE(r.meta_valor, 0) AS meta_valor_12m
    FROM meta_direta d
    FULL JOIN meta_rateada r ON r.chave IS NOT DISTINCT FROM d.chave
  ),
  calc AS (
    SELECT st.*,
           CASE WHEN st.media_mensal > 0 THEN st.desvio / st.media_mensal END        AS cv,
           CASE WHEN st.media_mensal > 0 THEN 100.0 * st.slope / st.media_mensal END AS tendencia_pct_mes,
           LEAST(v_cap_meta, GREATEST(
             COALESCE(p_meta_reducao_pct, 0) / 100.0,                       -- piso global
             COALESCE(m.meta_valor_12m, 0) / NULLIF(12.0 * st.media_aparada, 0),
             0))                                                            AS meta_aplicada
    FROM stats st
    LEFT JOIN metas m ON m.chave IS NOT DISTINCT FROM st.chave
  )
  SELECT jsonb_build_object(
    'meta', jsonb_build_object(
      'grao', CASE WHEN p_departamento IS NULL THEN 'departamento' ELSE 'plano_contas' END,
      'departamento_filtro', p_departamento,
      'janela_ini', v_mes_ini, 'janela_fim', v_mes_fim, 'meses', p_meses,
      'meta_global_pct', COALESCE(p_meta_reducao_pct, 0),
      'natureza', COALESCE(p_natureza, 'todas'), 'gerado_em', now()),
    'itens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'chave_id',          c.chave,
        'nome',              COALESCE(CASE WHEN p_departamento IS NULL THEN dep.nome
                                           ELSE tc.code || ' - ' || tc.name END,
                                      '(sem departamento)'),
        'n_meses',           c.n_meses,
        'meses_com_gasto',   c.meses_com_gasto,
        'media_mensal',      round(c.media_mensal, 2),
        'mediana',           round(c.mediana::numeric, 2),
        'media_aparada',     round(c.media_aparada, 2),
        'p10',               round(c.p10::numeric, 2),
        'p90',               round(c.p90::numeric, 2),
        'meses_aparados',    c.meses_aparados,
        'desvio',            round(c.desvio, 2),
        'cv',                round(c.cv, 3),
        'tendencia_pct_mes', round(c.tendencia_pct_mes, 2),
        'indices_sazonais',  (SELECT jsonb_agg(round(sn.indice, 3) ORDER BY sn.mes_cal)
                              FROM saz_norm sn WHERE sn.chave IS NOT DISTINCT FROM c.chave),
        'meta_reducao_aplicada_pct', round(100.0 * c.meta_aplicada, 2),
        'verba_mensal_proposta', round(c.media_aparada * (1 - c.meta_aplicada), 2),
        'verba_anual_proposta',  round(12 * c.media_aparada * (1 - c.meta_aplicada), 2),
        'verba_por_mes',     (SELECT jsonb_agg(round(c.media_aparada * (1 - c.meta_aplicada)
                                                     * sn.indice, 2) ORDER BY sn.mes_cal)
                              FROM saz_norm sn WHERE sn.chave IS NOT DISTINCT FROM c.chave),
        'banda_alerta_inf',  round(GREATEST(c.media_aparada * (1 - c.meta_aplicada) - c.desvio, 0), 2),
        'banda_alerta_sup',  round(c.media_aparada * (1 - c.meta_aplicada) + c.desvio, 2),
        'banda_invest_inf',  round(GREATEST(c.media_aparada * (1 - c.meta_aplicada) - 2 * c.desvio, 0), 2),
        'banda_invest_sup',  round(c.media_aparada * (1 - c.meta_aplicada) + 2 * c.desvio, 2),
        'classificacao', CASE
          WHEN c.meses_com_gasto < LEAST(12, p_meses / 2)
            OR COALESCE(c.cv, 0) >= 0.75
            OR COALESCE(c.tendencia_pct_mes, 0) >= 5 THEN 'critico'
          WHEN COALESCE(c.cv, 0) >= 0.30 THEN 'volatil'
          ELSE 'estavel' END
      ) ORDER BY c.media_mensal DESC)
      FROM calc c
      LEFT JOIN public.departamentos dep
        ON p_departamento IS NULL AND dep.id = c.chave
      LEFT JOIN public.trade_chart_of_accounts tc
        ON p_departamento IS NOT NULL AND tc.id = c.chave
    ), '[]'::jsonb)
  ));
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_orcamento_baseline(int, numeric, integer[], uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_orcamento_baseline(int, numeric, integer[], uuid, text, boolean) TO authenticated;
```

Notas de implementação: `verba_por_mes`/`indices_sazonais` são arrays posicionais Jan..Dez. Performance: 2 varreduras da janela sobre ~51k linhas, atendidas pelos índices da §5.3 — mesma classe do `fn_cp_dashboard` (<100ms). `trade_chart_of_accounts(id, code, name)` confirmado em `20251007173756_29dcfaf4:22-32`; `departamentos(id, nome, ativo)` em `20251201061637:2-10`. FK `contas_pagar.plano_contas_id → trade_chart_of_accounts` presumida (decisão D2) — confirmar no Lovable antes de aplicar.
