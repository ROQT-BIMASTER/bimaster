

## Fix: Visão Geral Financeira KPIs — Correct Column Names + Handle 1000-Row Limit

### Problems

1. **1000-row limit**: The query fetches rows directly and aggregates in JS, but Supabase caps at 1000 rows. With 38K+ records in `contas_receber`, the KPIs only reflect a tiny fraction of the data.
2. **`contas_pagar` columns are correct** (`valor_pago`), **`contas_receber` columns are now correct** (`valor_recebido` — fixed in prior edit). But both queries still hit the 1000-row cap.
3. **"Títulos Vencidos" count** only checks `contas_pagar` — should also count overdue `contas_receber`.

### Solution

Use `fetchAllRows` (already exists in the project) to paginate through all records in batches of 1000, then aggregate client-side. This is the same pattern used elsewhere in the app.

### File changed: `src/pages/Financeiro.tsx`

**KPI query rewrite:**
- Import `fetchAllRows` from `@/lib/utils/fetchAllRows`
- Replace both direct `.from().select()` calls with `fetchAllRows()` calls, passing date filters via `buildQuery` callback
- Column mapping stays as-is:
  - `contas_pagar`: `valor_original, valor_pago, valor_aberto, status, data_vencimento`
  - `contas_receber`: `valor_original, valor_recebido, valor_aberto, status, data_vencimento`
- Aggregation logic unchanged (sum `valor_aberto`, count vencidas)
- Add `contas_receber` overdue count to "Títulos Vencidos" (currently only counts `contas_pagar`)

**No other changes** — greeting, recent activities, layout, styling all stay the same.

### Technical detail

```typescript
// Before (hits 1000-row limit):
supabase.from("contas_receber").select("...").gte(...).lte(...)

// After (fetches all rows in batches):
fetchAllRows("contas_receber", "valor_original,valor_recebido,valor_aberto,status,data_vencimento", 
  (q) => q.gte("data_vencimento", startOfMonth).lte("data_vencimento", endOfMonth))
```

