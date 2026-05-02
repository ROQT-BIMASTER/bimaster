---
title: Finance Deep-Dive
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 09 — Finance Deep-Dive

## Visão geral

Módulo financeiro cobre AP (Contas a Pagar), AR (Contas a Receber), DRE,
Chart of Accounts, conciliação, projeções de caixa, sync com ERP Huggs,
provisões PDD, Sofia (agente IA), redução de custos com IA.

Pastas-chave:
- `src/pages/financeiro/` — sync screens.
- `src/pages/ContasPagarGestao.tsx`, `Pagamentos.tsx`, `CobrancaInadimplentes.tsx`.
- `src/components/financeiro/`, `src/components/dre/`,
  `src/components/conciliacao/`.
- Edge: `auditoria-contas-pagar`, `auditoria-contas-receber`,
  `classificar-categoria-dre`, `classificar-conta-departamento`,
  `classificar-contas-pagar-ia`, `auto-classificar-contas`,
  `bancos-api`, `categorias-api`, etc.

## Padrões obrigatórios

1. **Moeda**: `formatCurrency(value)` (com centavos). Nunca `toFixed(2)` solto.
2. **Datas `DATE`**: `parseLocalDate` (CRÍTICO em vencimentos — UTC shift
   muda o dia em SP).
3. **`DecimalInput`** com **4 casas** para alíquotas, juros, IVA, custos.
4. **Telas AP de governança**: **admin-only enforce** server-side.
5. **AP/AR pagas/canceladas são imutáveis**. Modificações só após reabertura
   justificada com auditoria.

## DRE — IFRS 18

- Estrutura hierárquica de Chart of Accounts v2.
- Grupos analíticos próprios (não livre digitação).
- Geração de DRE consolidado por período.
- `DREFontSizeControl` para densidade.
- Memórias:
  - `mem://finance/dre-professional-standard-ifrs-18`
  - `mem://features/finance/chart-of-accounts-v2-migration-logic-v2026`

## Contas a Pagar (AP)

- Sync com ERP Huggs via webhook + jobs (`docs/N8N_WEBHOOK_CONTAS_PAGAR.md`).
- Status restritos a `pago`/`cancelado` para bloquear edição.
- Auditoria por edge function `auditoria-contas-pagar`.
- Classificação automática por IA (`classificar-contas-pagar-ia`,
  `auto-classificar-contas`).
- Memórias:
  - `mem://features/finance/ap-module-implementation-lifecycle`
  - `mem://finance/contas-pagar-governance-and-audit-standard`
  - `mem://security/admin-only-ap-governance-screens`

## Contas a Receber (AR)

- Sync via `contas-receber*` edge functions.
- Mapeamento de status, datas e cálculo de Total tem regras próprias
  (`mem://finance/receivable-status-and-sync-governance`).
- Cobrança de inadimplentes em `src/pages/CobrancaInadimplentes.tsx`.

## Conciliação bancária

- `src/components/conciliacao/`.
- Match por valor + data + descrição com tolerâncias.
- Pluggy SDK (`pluggy-connect-sdk`, `react-pluggy-connect`) para Open Finance.

## Fornecedores

- Sync com API Huggs.
- Isolamento de fornecedores Fábrica (categoria própria).
- Memória: `mem://finance/supplier-governance-and-erp-sync-policy`.

## Provisões / PDD

- Regras contábeis de provisão para devedores duvidosos.
- Memória: `mem://finance/accounting-compliance-provisions-pdd`.

## Cash Flow & projeções

- KPIs DPO (Days Payable Outstanding) e DSO (Days Sales Outstanding).
- Projeções de caixa baseadas em AP/AR + recorrências.
- Memória: `mem://finance/cash-flow-audit-and-projection-standards`.

## Redução de custos com IA

- Auditoria de despesas, sugestões de renegociação, alertas.
- Memória: `mem://finance/cost-reduction-ecosystem-and-ai-audit`.

## Market compliance fiscal

- Campos fiscais obrigatórios para integração com ERP.
- Memória: `mem://finance/market-compliance-data-standard`.

## Sofia — agente financeiro

- Markdown rendering + Recharts inline + voz (ElevenLabs).
- Reauth por senha para ações destrutivas.
- Modelo: `openai/gpt-5.2` para reasoning; `gemini-flash` para conversação.
- Memória: `mem://ai/sofia-agente-financeiro-avancado`.

## Display & integridade

- Alinhamento de números à direita.
- Cores: positivo = `text-emerald-600` (via token), negativo = `text-destructive`.
  Sempre via token, nunca cor literal.
- Cálculos derivados em runtime quando possível (não persistir total que pode
  ficar dessincronizado).
- Memória: `mem://finance/display-and-data-integrity-standards`.

## Fluxos de webhook (n8n)

- AP: `docs/N8N_WEBHOOK_CONTAS_PAGAR.md`.
- AR: `docs/N8N_WEBHOOK_CONTAS_RECEBER.md`.
- Sempre validar assinatura HMAC e idempotência (`_shared/idempotency.ts`).

## APIs REST públicas relacionadas

Ver `docs/API_*.md`:
- `API_BANCOS.md`, `API_BANDEIRAS.md`, `API_BOLETOS.md`, `API_CATEGORIAS.md`,
  `API_CONTAS_CORRENTES.md`, `API_DRE_CADASTRO.md`,
  `API_FINALIDADES_TRANSFERENCIA.md`, `API_ORCAMENTOS_CAIXA.md`,
  `API_PARCELAS.md`, `API_RESUMO_FINANCEIRO.md`, `API_TIPOS_DOCUMENTO.md`.
