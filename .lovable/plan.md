

## Migration Analysis: Schema Conflicts Found

### Problem
Three tables in the SQL already exist with **different schemas**. `CREATE TABLE IF NOT EXISTS` will silently skip them, but the subsequent `CREATE INDEX` statements will **fail** because they reference columns that don't exist in the current tables.

| Table | Status | Conflict |
|-------|--------|----------|
| `erp_sync_log` | EXISTS | Has `entity_type`, `entity_id`, `action`, `direction` — migration expects `tabela_origem`, `registro_id`, `status`, `payload_enviado` |
| `contas_receber` | EXISTS | Has `erp_id`, `cliente_codigo`, `cliente_nome`, `parcela` — migration expects `cliente_id`, `num_parcelas`, `codigo_integracao`, `inativo` |
| `contas_bancarias` | EXISTS | Has `banco`, `agencia`, `conta`, `tipo` — migration's ALTER ADD COLUMN will work for new columns, but some like `agencia`, `numero_conta` overlap with existing `agencia`/`conta` |

### What will work as-is
- **New tables** (6): `parcelas_receber`, `recebimentos`, `lancamentos_conta_corrente`, `bancos`, `tipos_documento`, `tipos_conta_corrente`, `origens_titulo`, `bandeiras_cartao`, `finalidades_transferencia` — all fine
- **contas_bancarias ALTER** — partially fine (some columns already exist under slightly different names)

### What will fail
- Indexes on `erp_sync_log` referencing `tabela_origem`, `registro_id`, `proximo_envio` — columns don't exist
- Indexes on `contas_receber` referencing `cliente_id`, `codigo_integracao`, `inativo` — columns don't exist
- GRANT on `erp_sync_log` and `contas_receber` will succeed (harmless)

### Proposed Approach

**Split into two migrations:**

**Migration 1** — Safe parts (new tables + seed data + contas_bancarias alterations):
- Create `parcelas_receber`, `recebimentos`, `lancamentos_conta_corrente`
- Create lookup tables: `bancos`, `tipos_documento`, `tipos_conta_corrente`, `origens_titulo`, `bandeiras_cartao`, `finalidades_transferencia`
- Seed data for all lookup tables
- ALTER `contas_bancarias` to add missing columns (skipping `agencia` which already exists, renaming `numero_conta` addition since `conta` exists)
- All GRANTs

**Migration 2** — Add missing columns to existing tables via ALTER TABLE:
- `contas_receber`: ADD COLUMN IF NOT EXISTS for `cliente_id`, `conta_bancaria_id`, `descricao` (if missing), `data_competencia`, `valor_acrescimo`, `valor_liquido`, `num_parcelas`, `categoria`, `plano_conta_id`, `centro_custo_id`, `tags`, `observacoes`, `codigo_integracao`, `enviado_erp`, `bloqueado`, `inativo`, `data_inc`, `hora_inc`, `user_inc`, `data_alt`, `hora_alt`, `user_alt`
- Then create the indexes on `contas_receber` for the newly added columns
- `erp_sync_log`: ADD COLUMN IF NOT EXISTS for `tabela_origem`, `registro_id`, `payload_enviado`, `resposta_erp`, `codigo_erp`, `max_tentativas`, `proximo_envio`, `enviado_em`, `erro_mensagem`
- Then create the indexes on `erp_sync_log` for the newly added columns

### No frontend changes
Zero file modifications — database only.

