

# Garantir 100% dos Dados Carregados — Diagnóstico e Correções

## Problemas Encontrados

### Problema 1 (CRÍTICO): Dashboard Widget soma apenas 1.000 linhas
O `FinanceiroDashboardWidget` faz queries diretas sem paginação para somar `valor_aberto`:
```
supabase.from("contas_receber").select("valor_aberto").in("status", [...])
```
Com 43.813 registros pendentes e 11.171 vencidos, PostgREST retorna **apenas 1.000 linhas** — os totais financeiros exibidos no dashboard estão **severamente incorretos**.

### Problema 2: Empresa 11 com cobertura insuficiente no pg_cron
- Empresa 11 tem **77.913 registros** = 26 páginas (÷ 3000)
- Tem apenas **8 jobs × 3 páginas = 24 páginas** de cobertura
- **~6.000 registros ficam de fora** a cada sync noturna

### Problema 3: Incremental sobrepõe sync noturna
O job incremental roda `*/40 * * * *` (minutos 0, 40). Às 03:00 e 03:40 ele conflita com os jobs noturnos, causando **deadlocks** (confirmado nos logs: `emp11 deadlock detected`).

### O que está OK
- Listagem de Contas a Receber (`ContasAReceber.tsx`): usa paginação server-side + RPCs — correto
- Dashboard agregado (`DashboardContasReceberAggregated.tsx`): usa RPCs — correto
- Página Financeiro (`Financeiro.tsx`): usa paginação manual em loop — correto
- Sync engine: conexão reutilizada, page size 3000, time guard 110s — funcionando
- Total no banco: **473.060 registros** (todas as empresas)

## Plano de Correção

### Correção 1: Criar RPC para somas do Dashboard Widget
Criar uma function SQL `get_financeiro_dashboard_totais()` que retorna os 4 valores agregados diretamente no banco, eliminando o problema do limite de 1.000 linhas.

Atualizar `FinanceiroDashboardWidget.tsx` para chamar a RPC ao invés de queries diretas.

### Correção 2: Adicionar 1 job para Empresa 11
Criar `sync-cr-emp11-i` com `start_page=24, max_pages=3` para cobrir as últimas 2-3 páginas restantes.

### Correção 3: Evitar overlap do incremental com sync noturna
Alterar o schedule do incremental de `*/40 * * * *` para `10,50 0-2,5-23 * * *` — roda a cada ~40 min mas **pula a janela 03:00-04:59**.

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| Nova RPC `get_financeiro_dashboard_totais` | Migration SQL |
| `src/components/dashboard/FinanceiroDashboardWidget.tsx` | Trocar queries diretas por chamada RPC |
| pg_cron (SQL INSERT) | Adicionar emp11-i, ajustar schedule incremental |

