


# Eliminar N8N — Sync 100% via erp-sync-engine

## Status: IMPLEMENTADO ✅

### Correções Aplicadas

1. **SQL_PAGE_SIZE reduzido de 5000 para 3000** — cada página processa menos rows, mantendo dentro do limite de 110s
2. **pg_cron jobs recriados com max_pages=3** — cada invocação processa no máximo 9000 rows (3 páginas × 3000)
3. **~59 jobs escalonados entre 03:00 e 04:44** — empresas grandes divididas em múltiplas invocações
4. **Incremental mantido a cada 40 min** — pagamentos recentes (~500-2000 registros)
5. **N8N 100% eliminado** — edge functions legadas removidas, frontend unificado

### Cobertura por Empresa (pg_cron)

| Empresa | Registros | Páginas (3k/pg) | Jobs | Janela |
|---|---|---|---|---|
| 5, 7, 9 | 40-1568 | 1 | 1 cada | 03:00 |
| 8 | 25.928 | 9 | 3 | 03:01-03:05 |
| 1 | 35.183 | 12 | 4 | 03:02-03:08 |
| 10 | 55.729 | 19 | 7 | 03:10-03:22 |
| 3 | 73.192 | 25 | 9 | 03:24-03:40 |
| 11 | 77.913 | 26 | 8 | 03:42-03:56 |
| 4 | 92.443 | 31 | 11 | 03:58-04:18 |
| 6 | 110.938 | 37 | 13 | 04:20-04:44 |

### Resultado

- Empresa 1 testada: 3 páginas × 3000 = 9000 rows em **18s** (status: success)
- Zero deadlocks quando executado isoladamente (deadlocks só ocorrem em paralelo)
- Cron escalonado garante que nunca há 2 empresas grandes em paralelo
