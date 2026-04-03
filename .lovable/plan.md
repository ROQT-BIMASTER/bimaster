

# Diagnóstico: Sync Continua Falhando — Timeout em Todas as Rotas

## Evidências Concretas

### 1. Incremental (a cada 40 min) — TIMEOUT 504
Os logs confirmam: a rota `sync-contas-receber-incremental` atingiu **504 após 151 segundos**, processando 18.000+ registros antes de morrer. O filtro `WHERE [Vencimento] >= DATEADD(DAY, -2, GETDATE())` é muito amplo — captura milhares de títulos com vencimento recente, não apenas os alterados.

### 2. Full diária (3:30 AM) — IMPOSSÍVEL DE COMPLETAR
A rota `sync-contas-receber-full` tenta processar todas as empresas **sequencialmente dentro de uma única invocação**. Com a empresa 4 tendo 62k registros (31 páginas × ~5s = ~155s só para ela), o timeout ocorre antes de completar a primeira empresa grande.

### 3. sync_control confirma: apenas 3.000 registros por execução
Todas as entradas mostram `total_registros: 3000` — evidência de que a function morre após processar 1-2 páginas do SQL Server por invocação.

```text
Empresa 4  → 62.384 registros (31 páginas)  → precisa ~155s — TIMEOUT
Empresa 11 → 53.911 registros (27 páginas)  → precisa ~135s — TIMEOUT
Empresa 6  → 48.844 registros (24 páginas)  → precisa ~120s — LIMITE
Empresa 3  → 44.891 registros (22 páginas)  → precisa ~110s — LIMITE
Empresa 10 → 39.920 registros (20 páginas)  → precisa ~100s — OK se sozinha
Empresa 8  → 12.645 registros (6 páginas)   → precisa ~30s  — OK
Empresas 1,5,7,9 → <1.000 registros         → OK
```

## Solução: 3 Correções no `erp-sync-engine/index.ts`

### Correção 1: Full Sync via HTTP externo (não interno)

A rota `sync-contas-receber-full` atualmente chama `handleSyncPaginated()` internamente para cada empresa. Isso compartilha o mesmo timeout de 150s.

**Correção**: Usar `fetch()` para chamar a própria edge function externamente com `path: "sync-contas-receber-por-empresa"` para cada empresa. Cada `fetch()` dispara uma invocação separada com seu próprio timeout de 150s. O orquestrador apenas faz os fetches em paralelo (2-3 de cada vez) e coleta os resultados.

### Correção 2: Estreitar filtro incremental

Remover a cláusula de vencimento do filtro incremental. A derivação de status (`deriveStatus`) já recalcula "vencido" vs "pendente" em cada sync — não precisa buscar títulos só porque venceram:

```sql
-- ANTES (retorna 18k+):
WHERE [Data Pgto] >= DATEADD(HOUR, -2, GETDATE()) 
   OR ([Vencimento] >= DATEADD(DAY, -2, GETDATE()) AND [Vencimento] <= GETDATE())

-- DEPOIS (retorna ~500-2000):
WHERE [Data Pgto] >= DATEADD(HOUR, -2, GETDATE())
```

### Correção 3: pg_cron — Separar full em jobs por empresa

Em vez de um único job `sync-cr-full-diaria` que chama `sync-contas-receber-full` (que ainda pode dar timeout no orquestrador), criar jobs individuais escalonados:

```text
03:00 → empresa 8, 9, 5, 7, 1 (pequenas, ~30s cada)
03:10 → empresa 10 (~100s)
03:15 → empresa 3 (~110s)
03:20 → empresa 6 (~120s)
03:25 → empresa 11 (~135s)
03:30 → empresa 4 (~155s) — limite, mas é uma invocação isolada
```

## Plano de Execução

| Passo | Descrição |
|---|---|
| 1 | Refatorar `handleSyncContasReceberFull` para usar `fetch()` externo em paralelo (2 empresas por vez) |
| 2 | Estreitar WHERE do incremental para apenas `[Data Pgto] >= DATEADD(HOUR, -2, GETDATE())` |
| 3 | Remover job `sync-cr-full-diaria` e criar jobs individuais por empresa escalonados na madrugada |
| 4 | Manter job `sync-cr-incremental-40min` (agora com filtro estreito, ~500 registros) |
| 5 | Disparar sync full manual para validação |

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/erp-sync-engine/index.ts` | Refatorar full sync (fetch externo) + estreitar filtro incremental |
| pg_cron (SQL) | Substituir job full único por jobs por empresa escalonados |

## Resultado Esperado

- Incremental processa ~500-2000 registros em <30s (sem timeout)
- Full sync processa 100% dos 351k registros (cada empresa isolada com seu próprio timeout)
- Monitoramento via `sync_control` reflete registros reais por empresa

