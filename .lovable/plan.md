

## Migration Part 2/2: Issues Found & Corrected Plan

### Problems in the provided SQL

The SQL references `contas_a_pagar` but the actual table is **`contas_pagar`**. Additionally, `contas_pagar` is missing several columns that the functions/views reference:

| Referenced Column | Exists? | Actual Column |
|---|---|---|
| `contas_a_pagar` (table) | NO | `contas_pagar` |
| `contas_pagar.valor_liquido` | NO | `valor_aberto` (similar) |
| `contas_pagar.inativo` | NO | — |
| `contas_pagar.num_parcelas` | NO | `total_parcelas` |
| `contas_pagar.valor_pago` | YES | ✓ |

`contas_receber` has the expected columns (`inativo`, `valor_liquido`, `num_parcelas`, `data_alt`, `hora_alt`).

### Plan: Apply corrected migration

**Single migration** with these fixes applied:

1. **Triggers** (D) — Apply as-is. The audit trigger on `contas_receber`, `parcelas_receber`, `recebimentos`, `lancamentos_conta_corrente` will work since those tables have `data_alt`/`hora_alt`. Skip trigger on tables that lack those columns.

2. **fn_sync_titulo_receber_status** — Apply as-is (only touches `contas_receber` + `parcelas_receber`).

3. **fn_criar_titulo_receber** (E1) — Apply as-is.

4. **fn_registrar_recebimento** (E2) — Apply as-is.

5. **fn_enfileirar_erp** (E3) — Apply as-is (uses `erp_sync_log` which now has `tabela_origem`, `registro_id`, `proximo_envio`).

6. **fn_resumo_financeiro** (E4) — Fix all `contas_a_pagar` → `contas_pagar`, `valor_liquido` → `valor_aberto`, `inativo=FALSE` → `TRUE` (or remove), `num_parcelas` → `total_parcelas`.

7. **fn_pesquisar_titulos** (E5) — Same fixes: `contas_a_pagar` → `contas_pagar`, adapt column names to match actual schema (`valor_liquido` → `valor_aberto`, `num_parcelas` → `total_parcelas`, `importado_api` for `enviado_erp`).

8. **vw_contas_receber_completo** (F1) — Apply as-is (only uses `contas_receber` + `fornecedores`).

9. **vw_extrato_conta_corrente** (F2) — Fix `contas_a_pagar` → `contas_pagar`, verify `parcelas` join columns match (`parcelas.id` = `pag.parcela_id`, `parcelas.conta_pagar_id`).

10. **GRANTs** (G) — Apply as-is.

### Files changed
- **Migration only** — no frontend files modified

### Technical detail
The corrected SQL will use these column mappings for `contas_pagar`:
- `valor_liquido` → `valor_aberto`
- `inativo` → omitted (column doesn't exist; filter removed)
- `num_parcelas` → `total_parcelas`
- `importado_api` → `importado_api` (exists ✓)

