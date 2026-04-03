

# Fix: Sync 100% Funcional — Eliminar "partial" para Todas as Empresas

## Diagnóstico

O time guard de 110s interrompe a sync antes de completar empresas grandes. Os logs confirmam:

| Empresa | Registros no banco | Páginas necessárias (5k/pag) | Pages antes do timeout | Status |
|---|---|---|---|---|
| 6 | 110.938 | 23 | 5 (8k rows) | **partial** |
| 4 | 92.443 | 19 | 3 (4k rows) | **partial** |
| 3 | 73.192 | 15 | 5 (8k rows) | **partial** |
| 11 | 69.913 | 14 | 5 (8k rows) | **partial** |
| 10 | 55.729 | 12 | 9 (16k rows) | **partial** |
| 1 | 35.183 | 7 | 13 (24k rows) | **partial** |

**Causa raiz**: `ROW_NUMBER() OVER (ORDER BY ...)` recalcula o ranking inteiro a cada página, ficando mais lento em offsets altos. Cada página leva 20-30s (SQL + upsert de 5k rows em batches de 500).

**O pg_cron atual tem max_pages=10-15** — impossível caber em 110s quando cada página leva 20-30s. Máximo realista: **3-4 páginas por invocação**.

## Solução: Duas Correções

### Correção 1: Reduzir max_pages nos pg_cron jobs

Recalcular os cron jobs para usar `max_pages: 3` (seguro dentro de 110s). Cada empresa grande precisará de mais invocações escalonadas:

```text
Empresa 6  (23 pgs): 8 invocações × 3 páginas = start_page 0,3,6,9,12,15,18,21
Empresa 4  (19 pgs): 7 invocações × 3 páginas = start_page 0,3,6,9,12,15,18
Empresa 3  (15 pgs): 5 invocações × 3 páginas = start_page 0,3,6,9,12
Empresa 11 (14 pgs): 5 invocações × 3 páginas = start_page 0,3,6,9,12
Empresa 10 (12 pgs): 4 invocações × 3 páginas = start_page 0,3,6,9
Empresa 1  (7 pgs):  3 invocações × 3 páginas = start_page 0,3,6
```

Total: **32 invocações** escalonadas entre 03:00 e 04:05 (a cada 2 min).

### Correção 2: Otimizar a query SQL com OFFSET/FETCH

Trocar a subquery `ROW_NUMBER()` por `ORDER BY ... OFFSET X ROWS FETCH NEXT Y ROWS ONLY` (SQL Server 2012+). Embora ambos tenham custo similar em offsets altos, a sintaxe OFFSET é mais eficiente no plano de execução por evitar a materialização completa do subquery. Além disso, reduzir `SQL_PAGE_SIZE` de 5000 para 3000 para acelerar cada página individual (menos rows = upsert mais rápido).

```sql
-- ANTES (lento em offsets altos):
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (ORDER BY [ID Empresa],[Nota],[Seq]) AS _rn
  FROM [ConsultaPowerBIReceber] WHERE [ID Empresa] = 6
) AS _paged WHERE _rn > 15000 AND _rn <= 20000

-- DEPOIS:
SELECT * FROM [ConsultaPowerBIReceber]
WHERE [ID Empresa] = 6
ORDER BY [ID Empresa], [Nota], [Seq]
OFFSET 15000 ROWS FETCH NEXT 3000 ROWS ONLY
```

## Execução

| Passo | Descrição |
|---|---|
| 1 | Alterar `handleSyncPaginated`: trocar `ROW_NUMBER()` por `OFFSET/FETCH`, reduzir `SQL_PAGE_SIZE` para 3000 |
| 2 | Remover **todos** os 15 jobs antigos (IDs 11, 19-30) |
| 3 | Criar novos pg_cron jobs: pequenas (1 job cada) + grandes (3-8 jobs cada, max_pages=3, escalonados a cada 2 min) |
| 4 | Manter job incremental a cada 40 min (job 11 — filtro temporal, poucos registros) |
| 5 | Disparar sync manual de uma empresa grande para validar |

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/erp-sync-engine/index.ts` | Trocar ROW_NUMBER por OFFSET/FETCH, SQL_PAGE_SIZE=3000 |
| pg_cron (SQL) | Recriar ~35 jobs com max_pages=3 |

## Resultado Esperado

- Zero "partial" — cada invocação completa suas 3 páginas dentro de 110s
- 100% dos ~465k registros sincronizados diariamente via 35 jobs escalonados
- Incremental mantido a cada 40 min para pagamentos do dia

