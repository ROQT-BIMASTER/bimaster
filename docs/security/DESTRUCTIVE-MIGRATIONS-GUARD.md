# Defesa contra perda de dados em migrations

Resposta ao incidente [2026-05-16 Fábrica BR](../incidents/2026-05-16-fabrica-br-data-loss.md).
Três camadas independentes:

## 1. CI guard (`guard-destructive-migrations`)

Script: `scripts/ci/guard-destructive-migrations.sh`
Workflow: `.github/workflows/guard-destructive-migrations.yml`

Falha o PR se qualquer migration **nova** contiver `DELETE FROM`, `TRUNCATE`,
`DROP TABLE`, `DROP SCHEMA` ou `ALTER ... DROP COLUMN` em tabelas com prefixo
de domínio (`fabrica_`, `china_`, `projeto_`, `trade_`, `financeiro_`,
`contas_`, `marketing_`, `inbox_`, `vendas_`, `compras_`, `estoque_`,
`composicao_`, `ficha_`, `ordens_`, `produtos_`, `tarefas_`, `aprovacoes_`),
sem o token de override:

```sql
-- ALLOW-DESTRUCTIVE: zera tabela de teste após reset (BIM-1234)
DELETE FROM fabrica_produtos WHERE ...;
```

Rodar local antes do push:

```bash
bash scripts/ci/guard-destructive-migrations.sh
```

## 2. Kill-switch no Postgres (`guard_bulk_delete`)

Migration `20260518_*_guard_bulk_delete`. Trigger `AFTER DELETE FOR EACH STATEMENT`
em tabelas críticas Fábrica BR (`fabrica_produtos`, `fabrica_formulas`,
`fabrica_materias_primas`, `fabrica_notas_fiscais`, `fabrica_tabelas_preco`,
`fabrica_ordens_producao`, `fabrica_produto_custos`, `fabrica_compras`, etc.).

Aborta se um único statement tenta apagar **> 50 linhas** sem autorização explícita
na mesma transação:

```sql
BEGIN;
SET LOCAL app.allow_bulk_delete = 'on';
DELETE FROM fabrica_produtos WHERE empresa_id = '...';
COMMIT;
```

Operações normais do app (UI apaga 1 registro) não disparam o bloqueio.

## 3. PR template + CODEOWNERS

- `.github/PULL_REQUEST_TEMPLATE.md` força checklist específico para PRs com
  migration destrutiva (token, escopo, backup confirmado, CI verde, revisor humano).
- `.github/CODEOWNERS` exige aprovação de `@bimaster/backend` **e**
  `@bimaster/security` em qualquer mudança em `supabase/migrations/` e no
  próprio script de guard.

## Próximas camadas (futuro)

4. Snapshot automático `pg_dump --data-only` das tabelas afetadas antes de
   aplicar migration destrutiva, com retenção 30d.
5. PITR habilitado + cron diário comparando `count(*)` de tabelas críticas
   com o dia anterior; alerta se queda > 20% sem deploy autorizado.
