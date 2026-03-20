

## Fix: Contas a Receber Dashboard — Bypass Broken RPCs with Direct Queries

### Problem
The 6 RPC calls in `DashboardContasReceberAggregated.tsx` return empty data because PostgREST's schema cache doesn't expose them. The Table tab works fine because it queries the `contas_receber` table directly.

### Solution
Replace all 6 RPC-based queries with direct `fetchAllRows` queries against `contas_receber`, computing aggregations in JavaScript. All existing UI (cards, charts, PMR modal, filters) stays identical.

### What stays untouched
- All tabs (Tabela, Calendário) — zero changes
- All filters, buttons, layout, styling — preserved exactly
- All visual components (cards, charts, PMR dialog) — same JSX
- No database migrations

### File changed: `src/components/financeiro/DashboardContasReceberAggregated.tsx`

**Replace 6 RPC queries with 1 direct query + JS aggregation:**

1. **Single data fetch**: Use `fetchAllRows("contas_receber", columns, buildFilters)` with the same filter logic from `ContasAReceber.tsx` (`empresa_id`, `conta`, `portador`, `data_vencimento`, `data_recebimento`, year/month ranges)

2. **Columns fetched**: `valor_original, valor_aberto, valor_recebido, status, data_vencimento, data_emissao, data_recebimento, cliente_nome, empresa_id, conta, portador, dias_atraso`

3. **Client-side aggregations** (mirror RPC logic):

| Aggregation | Logic |
|---|---|
| **KPIs** | Count/sum by status (recebido/pendente/vencido). Vencido = status != recebido AND data_vencimento < today. Vencendo hoje/7d/15d/30d = date range checks. PMR = avg(data_recebimento - data_emissao) for recebido. Variação mensal = compare current vs previous month totals. |
| **Evolução Mensal** | Group by YYYY-MM of data_vencimento, sum valor_recebido vs valor_aberto |
| **Top 10 Clientes** | Group by cliente_nome, sum valor_aberto where status != recebido, sort desc, take 10, truncate names |
| **Aging** | Bucket by dias_atraso (or calculated from data_vencimento): 0-15, 16-30, 31-60, 61-90, 90+ days |
| **Status Distribution** | Group by status, count + sum valor_aberto |
| **PMR Details** | Compute from recebido records: avg/min/max/median of (data_recebimento - data_emissao), faixas, por_mes breakdown |

4. **Filter builder**: Inline function mirroring `buildBaseFilters` from `ContasAReceber.tsx` — applies `empresa_id`, `conta`, `portador`, `data_vencimento`, `data_recebimento`, year/month ranges via Supabase query builder

5. **Performance**: ~38K rows × 12 columns ≈ 3-4MB. Fetched in batches of 1000 via `fetchAllRows`. Cached with 5-min staleTime.

### Technical approach

```text
Before (broken):
  6 RPC calls → PostgREST cache miss → empty data → R$0

After (working):
  1 fetchAllRows call → direct table query → all rows → JS aggregation → correct KPIs
```

All `useMemo` computations derive from the single fetched dataset. The 6 separate `useQuery` hooks collapse into 1 query + 6 `useMemo` blocks. Loading/error states preserved.

