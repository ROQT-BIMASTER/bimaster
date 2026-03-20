

## Fix: Dashboard KPIs Showing R$0

### Root Cause Analysis

All 10 `get_contas_receber_*` database functions were verified to work correctly at the SQL level — returning ~39,000 records with ~R$52M in values. The `search_path=public` fix from the previous migration IS deployed and functional.

**Most likely cause**: PostgREST (the API layer between the frontend and database) has a **stale schema cache**. After the previous migration recreated all 10 functions, PostgREST may not have reloaded its internal schema, causing API calls from the frontend to fail silently (returning null/empty).

### Evidence
- `get_contas_receber_dashboard_kpis(NULL, 2026, ...)` returns valid data when called via SQL
- All 5 dashboard RPCs (kpis, evolucao, top_clientes, aging, status_dist) return correct data
- Only one version of each function exists (no overload conflicts)
- `search_path=public` is correctly set on all functions

### Fix

**Single migration** that sends a `NOTIFY pgrst, 'reload schema'` signal to force PostgREST to reload its function catalog. This is a no-data-change migration — it only refreshes the API layer.

Additionally, as a belt-and-suspenders approach: `DROP` and re-`CREATE` the `get_contas_receber_dashboard_kpis` function (identical logic) to force PostgREST to recognize the latest signature.

### Files changed
- 1 new migration file (schema reload signal + function re-creation)
- No frontend changes

