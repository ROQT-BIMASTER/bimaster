

## Fix: All Contas a Receber RPCs Broken — Empty `search_path`

### Root Cause

All 10 `get_contas_receber_*` database functions have `SET search_path TO ''` (empty string). This means they cannot resolve the `contas_receber` table, causing every RPC call to fail with `relation "contas_receber" does not exist`. The dashboard shows R$0 because all queries silently error out.

### Solution

A single database migration that recreates all 10 functions with `SET search_path = public` instead of the empty string. The SQL logic inside each function is correct — only the `search_path` setting needs to change.

### Functions to fix (all same change: `search_path TO ''` → `search_path TO 'public'`)

| Function | Params |
|---|---|
| `get_contas_receber_dashboard_kpis` | 5 params (drop this overload, keep 7-param) |
| `get_contas_receber_dashboard_kpis` | 7 params |
| `get_contas_receber_evolucao_mensal` | 4 params |
| `get_contas_receber_top_clientes` | 5 params |
| `get_contas_receber_aging` | 5 params |
| `get_contas_receber_status_dist` | 5 params |
| `get_contas_receber_pmr_detalhes` | 5 params |
| `get_contas_receber_calendario` | 4 params |
| `get_contas_receber_filter_options` | 1 param |
| `get_contas_receber_filtros` | 1 param |

### Additional cleanup
- Drop the duplicate 5-param `get_contas_receber_dashboard_kpis` (the 7-param version supersedes it and handles all cases)

### Approach
1. Single migration: DROP + CREATE OR REPLACE for each function, preserving all existing SQL logic but fixing `search_path`
2. No frontend changes — the existing code will work once RPCs return data

### Files changed
- 1 new migration file only

