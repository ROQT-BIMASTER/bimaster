

# Unificacao dos 3 Ambientes de Contas a Pagar

## Diagnostico: 3 telas, 2 camadas de dados

| Tela | Rota | Fonte de Dados | Status API |
|---|---|---|---|
| `ContasAPagar` | `/financeiro/contas-a-pagar` | **Supabase direto** (`supabase.from('contas_pagar').select(...)`) | NAO usa API |
| `ContasPagarGestao` | `/contas-pagar` | `callApi("contas-pagar-api")` | Migrado |
| `PainelCentralAP` | `/financeiro/ap-central` | `callApi("contas-pagar-api")` + `callExportApi` | Migrado |

A tela que aparece no screenshot 2 (a principal, com tabs Dashboard/Calendario/Contas a Pagar/Orcamentos/Classificacao IA) e a `ContasAPagar` — **1846 linhas fazendo SELECT direto no Supabase sem passar pela API**. Isso inclui:
- Dashboard com KPIs calculados client-side
- Calendario de vencimentos
- Tabela com paginacao manual via `.range()`
- Classificacao IA
- Realtime via `postgres_changes`

A `ContasPagarGestao` (screenshot 1) e uma versao simplificada que ja foi migrada para APIs mas duplica funcionalidade.

## Problema Central

`ContasAPagar` e a tela principal usada em producao, mas e a unica que **nao passa pela API**. Ela faz loops de `while(hasMore)` buscando 1000 registros por vez diretamente do Supabase — sem idempotencia, sem audit trail, sem envelope padronizado.

## Plano de Correcao

### Passo 1 — Migrar `ContasAPagar` para usar APIs (CRITICO)

Refatorar as 3 queries principais em `ContasAPagar.tsx`:

1. **`contasDashboard`** (linha 254-290): Substituir `supabase.from('contas_pagar').select('*')` com loop de paginacao por `callApi("contas-pagar-api", { path: "/query", limit: 1000, ... })` usando cursor pagination
2. **`contasCalendario`** (linha 293-341): Mesmo tratamento — usar `/query` com filtros de ano
3. **`contasTable`** (linha 343+): Substituir `supabase.from('contas_pagar').select('*', { count: 'exact' })` por `callApi("contas-pagar-api", { path: "/query", limit: pageSize, offset: (currentPage-1)*pageSize })` que ja retorna `total_de_registros`

### Passo 2 — Deprecar `ContasPagarGestao`

Redirecionar `/dashboard/contas-pagar` para `/dashboard/financeiro/contas-a-pagar`. A `ContasPagarGestao` duplica funcionalidade que ja existe na tela principal. Manter apenas como redirect para nao quebrar bookmarks.

### Passo 3 — Integrar funcionalidades do PainelCentralAP no ContasAPagar

O `PainelCentralAP` tem features que a tela principal nao tem:
- Coluna ERP status
- Bulk actions (cancelar lote, enviar ERP lote)
- Filtro por emissao
- Export Excel

Adicionar essas funcionalidades na aba "Contas a Pagar" da tela principal, criando um ambiente unico e completo.

### Passo 4 — PainelCentralAP permanece como tela admin

Manter como visao administrativa com foco em operacoes ERP (fila exportacao, reconciliacao). Nao duplicar a gestao basica.

## Arquivos alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/ContasAPagar.tsx` | Migrar 3 queries de Supabase direto para `callApi` com `/query` endpoint |
| `src/pages/ContasPagarGestao.tsx` | Substituir por redirect para `/dashboard/financeiro/contas-a-pagar` |
| `src/App.tsx` | Atualizar rota `/dashboard/contas-pagar` para redirect |

## Impacto

- Uma unica fonte de dados (API) para todas as telas
- Idempotencia, validacao Zod e audit trail em 100% das operacoes
- Elimina 1000 linhas de codigo duplicado (ContasPagarGestao)
- Consistencia total entre o que o ERP ve e o que o usuario ve

