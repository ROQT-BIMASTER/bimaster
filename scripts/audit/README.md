# scripts/audit/

Geradores determinísticos de snapshots para a auditoria contínua. Cada script
lê apenas filesystem / SQL e escreve markdown em
`docs/audit/2026-Q2/generated/`. **Não editam código de produto.**

## Scripts

| Script | Saída | Lê |
| --- | --- | --- |
| `list-routes.mjs` | `ROUTES.snapshot.md` | `src/App.tsx` |
| `list-edge.mjs` | `EDGE_FUNCTIONS.snapshot.md` | `supabase/functions/*/index.ts` |
| `list-modules.mjs` | `MODULES.snapshot.md` | `src/{pages,components,hooks,contexts}/` |
| `code-health.mjs` | `CODE_HEALTH.snapshot.md` | `src/**/*.{ts,tsx}` (exclui `types.ts`) |
| `db-stats.sql` | `DB_STATS.snapshot.csv` | DB via `psql` |
| `security-definer-snapshot.mjs` | (pré-existente) | DB |

## Uso local

```bash
bash scripts/audit/run-all.sh
```

Exige `node` (≥18) e, para o snapshot de DB, `psql` com `PGHOST/PGUSER/PGPASSWORD/PGDATABASE` configurados.

## Workflow

`.github/workflows/docs-drift.yml` roda `run-all.sh` em todo PR que tocar
`src/`, `supabase/functions/`, `scripts/audit/` ou `docs/audit/`. Se algum
snapshot mudou, o job falha com instrução para o autor regenerar e commitar.

## Princípios

- **Determinístico**: saída idêntica para entrada idêntica (ordens estáveis, sem timestamps).
- **Sem dependências externas**: apenas Node nativo. Sem `npm install`.
- **Sem mutação**: lê e escreve apenas em `docs/audit/2026-Q2/generated/`.
- **Versionado**: snapshots vão para o repo; drift = PR de docs.
