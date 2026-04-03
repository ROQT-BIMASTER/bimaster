

# Melhorias Priorizadas — Análise da Engenharia

## Estado Atual (dados reais do banco)

| Métrica | Valor |
|---|---|
| Total registros | 339.199 |
| Tabela | 503 MB |
| Índices | 22 (todos os recomendados já existem) |
| pg_cron jobs | 61 ativos, apenas 1 execução registrada (jobs recém-criados) |
| Deadlocks últimas 2h | Empresa 11 — 2 batches com deadlock |
| Incremental | Timeout (176s, 6000 rows) — filtro `[Data Pgto] >= DATEADD(HOUR, -2, GETDATE())` muito amplo |

## O que JÁ está OK (não precisa mudar)

- **Índices**: Todos os 4 recomendados (`erp_id`, `empresa_id`, `status`, `data_vencimento`) já existem, incluindo compostos (`empresa_id, data_vencimento`, `empresa_id, cliente_codigo`)
- **Chave erp_id**: 5 campos, determinística, zero duplicatas
- **RPCs agregadoras**: Dashboard usa server-side aggregation
- **Status mapping**: Lógica com fallback para títulos quitados por ajuste

## Melhorias a Implementar

### 1. ALTA: Incremental baseado em estado (last_sync_timestamp)

**Problema**: O filtro `DATEADD(HOUR, -2, GETDATE())` captura milhares de registros e estoura o time guard (176s para 6000 rows). Além disso, risco de perda de dados se houver atraso.

**Solução**: Salvar `last_sync_timestamp` no `sync_control` e usar `WHERE [Data Pgto] >= @lastSync OR [Vencimento] >= @lastSync` para capturar apenas mudanças reais desde a última execução bem-sucedida.

**Arquivo**: `supabase/functions/erp-sync-engine/index.ts`
- Na rota `sync-contas-receber-incremental`, buscar o último `ultima_sync` com `status = 'success'` da tabela `sync_control`
- Usar esse timestamp como filtro em vez de `DATEADD(HOUR, -2, ...)`
- Fallback para 2 horas caso não exista registro anterior

### 2. ALTA: Retry automático com backoff em falhas de upsert

**Problema**: Deadlocks em emp11 causam `partial` sem re-tentativa. Batches perdidos ficam sem reprocessar.

**Solução**: Adicionar retry (máx 2 tentativas, delay 500ms → 1000ms) no `batchUpsert` quando o erro contiver "deadlock".

**Arquivo**: `supabase/functions/erp-sync-engine/index.ts` — função `batchUpsert`

### 3. ALTA: SSL na conexão SQL Server

**Problema**: `encrypt: false` e `trustServerCertificate: true` — dados trafegam sem criptografia.

**Solução**: Alterar para `encrypt: true` (manter `trustServerCertificate: true` se o certificado for auto-assinado). Validar que a conexão funciona antes de remover o fallback.

**Arquivo**: `supabase/functions/erp-sync-engine/index.ts` — `connectToSqlServer()`

### 4. MÉDIA: Materialized View para dashboard de KPIs

**Problema**: RPCs calculam agregações em tempo real sobre 339k registros a cada request do dashboard.

**Solução**: Criar uma materialized view `mv_financeiro_dashboard` com os KPIs pré-calculados. Refresh automático via pg_cron a cada 15 minutos.

**Alterações**:
- Migration SQL: criar MV + índice + job pg_cron `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- Atualizar RPC `get_financeiro_dashboard_totais` para ler da MV

### 5. MÉDIA: Observabilidade — métricas estruturadas

**Problema**: Logs são `console.log` dispersos. Não há visibilidade de tendências (duração média, taxa de erro, rows/s).

**Solução**: Adicionar uma tabela `sync_metrics` com campos: `entity`, `empresa_id`, `pages`, `rows`, `duration_ms`, `errors`, `rows_per_second`, `timestamp`. Popular no final de cada sync. Criar um widget no SyncMonitorPanel com gráfico de tendência.

**Alterações**:
- Migration: tabela `sync_metrics`
- `erp-sync-engine/index.ts`: inserir métricas no `recordSync`
- `SyncMonitorPanel.tsx`: widget de tendência

## Itens Descartados (com justificativa)

| Sugestão | Motivo |
|---|---|
| Hash MD5 no erp_id | Índice btree em varchar(50) é eficiente o suficiente para 339k registros. MD5 perde legibilidade para debug |
| Migrar pg_cron para fila/Redis | Complexidade desproporcional — pg_cron atende bem para 61 jobs com escalonamento fixo |
| OFFSET/FETCH vs ROW_NUMBER | Testado anteriormente — performance similar, ROW_NUMBER é mais estável com o driver tedious |

## Ordem de Execução

1. Retry com backoff (deadlocks) — impacto imediato
2. Incremental baseado em estado — elimina timeouts
3. SSL na conexão — segurança
4. Materialized View — performance de dashboard
5. Observabilidade — visibilidade operacional

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/erp-sync-engine/index.ts` | Retry em batchUpsert, incremental com last_sync, SSL |
| Migration SQL | MV `mv_financeiro_dashboard` + tabela `sync_metrics` + pg_cron refresh |
| `src/components/financeiro/SyncMonitorPanel.tsx` | Widget de tendência de métricas |

