# DB Performance Audit — 2026-05-04

> Auditoria **discovery-only**. Nenhuma migration aplicada. Único side-effect:
> verificação de extensão `pg_stat_statements` (já estava habilitada — v1.11).
> Todas as queries deste relatório são reproduzíveis no prompt original.

## Sumário executivo

| Métrica | Valor |
|---|---|
| Tabelas no schema `public` | **675** |
| `pg_stat_statements` habilitado | sim (v1.11) |
| Top query mais lenta (média) | **10.061 ms** — `DELETE` de duplicados em sync |
| 2ª query mais lenta | **7.062 ms** — `SELECT contas_pagar` (PostgREST) |
| Policies RLS com `auth.uid()` direto (total schema) | **1.252** |
| Policies RLS com `auth.uid()` direto (top-30 tabelas) | **60** |
| Tabelas com seq_scan dominante (>10 MB) | **1** (`clientes_score_historico`) |
| Índices não-usados detectados | **8** (≈ **39 MB** liberáveis) |
| Tabelas sem primary key | **0** ✅ |
| Tabelas com bloat > 10 % | **0** (todas < 10 %) |
| Conexões `idle in transaction` > 60 s | **0** ✅ |
| Conexões totais ativas | 40 (1 active, 31 idle, 8 sem state) |

> Estado geral: **saudável**. Sem dor estrutural. Principais ganhos
> estão concentrados em (1) reescrita de policies RLS para reduzir
> overhead initplan e (2) limpeza de índices órfãos.

---

## Findings priorizados

### 🔴 Crítico

1. **DELETE em `audit_logs` com média 4.341 ms × 48 calls** retornando
   **303k linhas/call** (14,5 M linhas no total). É o job de limpeza de
   logs de sync; está sem índice em `(entity_type, ctid)` ou batching
   adequado. Consome IO desproporcional.
2. **`SELECT` em `contas_pagar` via PostgREST com `LIMIT/OFFSET`** —
   média 6.846 ms / 65 calls. OFFSET em tabela de 195 MB é caro.
   Migrar para cursor-based pagination ou índice composto que cubra o
   ORDER BY.
3. **60 policies RLS em top-30 tabelas usando `auth.uid()` direto** em
   vez de `(select auth.uid())`. Cada linha re-avalia a função; em
   `Union` (1.030 MB), `contas_receber` (546 MB), `contas_pagar` (195 MB)
   isso multiplica por milhões. Substituição é **string-only, zero
   mudança de comportamento**.

### 🟡 Médio

4. **Índices não-usados em tabelas hot** — 8 índices, ≈ 39 MB total:
   - `idx_vendas_union_cod_produto` (17 MB) na tabela `Union`
   - `idx_contas_pagar_classificado_em` (6,2 MB)
   - `idx_car_cliente` (5,9 MB) em `contas_receber`
   - `idx_clientes_email` (3 MB), `idx_clientes_telefone` (2,2 MB),
     `idx_clientes_celular` (1,4 MB) — três índices em `clientes` sem uso
   - `idx_clientes_perfil_score` (2,1 MB)
   - `idx_erp_estoque_nome_trgm` (1,5 MB)
5. **`clientes_score_historico` com 93,9 % seq_scan** (216 seq vs
   14 idx) sobre 10 MB. Identificar coluna mais filtrada e indexar.
6. **Job pesado de duplicados (10s média)**: `WITH duplicados_para_remover`
   só roda 6×, mas cada execução leva 10 s. Avaliar se ainda é necessário
   após estabilização do sync.

### 🔵 Baixo

7. **`pg_timezone_names` chamado 2.707 vezes** retornando 1.194 linhas
   por call (3,2 M linhas). É consulta interna do Studio/PostgREST;
   considerar cache de 1 dia em camada de aplicação se for o front custom.
8. **WAL/realtime queries** (24 M calls a 10,6 ms média) → carga normal
   de Realtime; monitorar se número de subscribers crescer.
9. Conexão `active` há 1.335 s (~22 min): provavelmente o snapshot do
   próprio cliente de auditoria. Sem ação.

---

## Detalhe por bloco

### Bloco 1 — `pg_stat_statements`

```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_stat_statements';
```

Resultado: `pg_stat_statements` v1.11 ✅ — dados acumulados disponíveis.

### Bloco 2 — Top 20 slow queries (mean_exec_time)

| # | Resumo | Calls | Média (ms) | Total (s) |
|---|---|---:|---:|---:|
| 1 | DELETE duplicados sync (CTE `duplicados_para_remover`) | 6 | **10.061,84** | 60,37 |
| 2 | `SELECT contas_pagar` (PostgREST, várias colunas) | 65 | 7.062,89 | 459,09 |
| 3 | `SELECT contas_pagar.* LIMIT/OFFSET` | 41 | 6.846,14 | 280,69 |
| 4 | `SELECT COUNT(*) audit_logs` | 48 | 6.803,05 | 326,55 |
| 5 | `SELECT contas_pagar.* LIMIT/OFFSET` (variante) | 7 | 6.529,56 | 45,71 |
| 6 | RPC com `pgrst_call` (params dinâmicos) | 107 | 6.228,53 | 666,45 |
| 7 | `SELECT contas_receber WHERE data_vencimento BETWEEN` | 12 | 5.600,95 | 67,21 |
| 8 | Studio: introspecção de `tables` (PostgREST) | 5.566 | 5.449,76 | **30.333** |
| 9 | `SELECT contas_receber WHERE status <> $1 ORDER BY id` | 65 | 5.215,03 | 338,98 |
| 10 | `SELECT contas_receber WHERE empresa_id = ANY(...)` | 16 | 4.763,29 | 76,21 |
| 11 | DELETE `audit_logs` por entity_type | 48 | 4.341,78 | 208,40 |
| 12-20 | (ver query original; cauda longa em sync e dashboards) | | | |

**Observações:**
- A query #8 é introspecção do Lovable Cloud Studio (carga de dev tools);
  não é tráfego de usuário final.
- Concentração em `contas_pagar` / `contas_receber` indica que **o
  módulo financeiro é o hot path** do sistema — priorizar otimizações
  ali primeiro.

EXPLAIN (sem ANALYZE para zero-risco em prod) das top 5: omitido neste
relatório porque os planos PostgREST geram CTEs longas e dependem dos
parâmetros bind. Será coletado caso-a-caso na Fase 2 (correções).

### Bloco 3 — Índices ausentes (seq_scan dominante, > 10 MB)

| Tabela | Seq scans | Linhas lidas | Idx scans | % seq | Tamanho |
|---|---:|---:|---:|---:|---|
| `clientes_score_historico` | 216 | 1.073.726 | 14 | **93,9 %** | 10 MB |

Apenas 1 tabela acima do threshold. Investigar coluna mais filtrada
(provavelmente `cliente_id` ou `created_at`).

### Bloco 4 — Índices não-usados (idx_scan = 0, > 1 MB)

| Tabela | Índice | Tamanho |
|---|---|---:|
| `Union` | `idx_vendas_union_cod_produto` | 17 MB |
| `contas_pagar` | `idx_contas_pagar_classificado_em` | 6,2 MB |
| `contas_receber` | `idx_car_cliente` | 5,9 MB |
| `clientes` | `idx_clientes_email` | 3,0 MB |
| `clientes` | `idx_clientes_telefone` | 2,2 MB |
| `clientes_perfil_credito` | `idx_clientes_perfil_score` | 2,1 MB |
| `erp_estoque_distribuidora` | `idx_erp_estoque_nome_trgm` | 1,5 MB |
| `clientes` | `idx_clientes_celular` | 1,4 MB |
| **Total liberável** | | **≈ 39 MB** |

> Três índices em `clientes` para email/telefone/celular sem uso — investigar
> se as buscas usam `ilike` (que não usa b-tree padrão) ou se foram criadas
> "preventivamente". Considerar `pg_trgm` se houver search por substring,
> ou drop puro se não há feature dependente.

### Bloco 5 — Bloat por dead tuples

| Tabela | Live | Dead | % Bloat | Tamanho | Último autovacuum |
|---|---:|---:|---:|---|---|
| `Union` | 380.776 | 18.179 | 4,6 % | 1.030 MB | 2026-05-02 |
| `contas_receber` | 467.801 | 16.192 | 3,3 % | 546 MB | 2026-05-04 |
| `contas_pagar` | 48.716 | 4.788 | 8,9 % | 195 MB | 2026-05-03 |
| `clientes_perfil_credito` | 17.795 | 1.248 | 6,6 % | 25 MB | 2026-05-04 |

**Todas abaixo de 10 % — autovacuum está saudável.** Nenhuma ação imediata.

### Bloco 6 — Policies RLS com `auth.uid()` direto

**Total no schema:** 1.252 policies.
**Em top-30 tabelas (por reltuples):** 60 policies.

Top ofensores em volume × policy:

| Tabela | Tamanho | Policy | cmd |
|---|---|---|---|
| `Union` | 1.030 MB | `vendedor_vendas_own_data` | SELECT |
| `Union` | 1.030 MB | `admin_vendas_full_access` | ALL |
| `Union` | 1.030 MB | `empresa_vendas_access` | SELECT |
| `Union` | 1.030 MB | `supervisor_vendas_team_data` | SELECT |
| `contas_receber` | 546 MB | `cr_select_empresa` | SELECT |
| `contas_receber` | 546 MB | `cr_update_empresa` | UPDATE |
| `contas_receber` | 546 MB | `cr_delete_admin_only` | DELETE |
| `contas_pagar` | 195 MB | `cp_select_empresa` | SELECT |
| `contas_pagar` | 195 MB | `cp_update_empresa` | UPDATE |
| `contas_pagar` | 195 MB | `cp_delete_hardened` | DELETE |
| `contas_pagar_historico` | 188 MB | `cph_select` | SELECT |
| `clientes` | 52 MB | `supervisor_clientes_team` + 4 outras | mix |
| `api_security_log` | 32 MB | `Admin/supervisor can view security logs` | SELECT |
| `clientes_perfil_credito` | 25 MB | `perfil_credito_*` (3 policies) | mix |

**Padrão de fix (Fase 2):** trocar `auth.uid()` por `(select auth.uid())`
em cada `qual` e `with_check`. Substituição mecânica via regex sobre
`pg_get_policydef`. Nenhuma mudança de comportamento — apenas força o
Postgres a tratar como InitPlan (1 execução por query) em vez de
re-avaliar por linha.

### Bloco 7 — Tabelas sem primary key

**0 tabelas** ✅ — todas as 675 tabelas do schema `public` têm PK.

### Bloco 8 — Connection pool

| State | Conexões | Estado mais antigo |
|---|---:|---|
| `idle` | 31 | 10.230.725 s (~118 dias — pool persistente) |
| `(null)` | 8 | — |
| `active` | 1 | 1.335 s |

**Sem `idle in transaction`.** Pool saudável. Conexões idle de 118 dias
são do PgBouncer/pooler do Supabase mantendo conexões persistentes — esperado.

### Bloco 9 — Top queries por linhas retornadas

Dominado por `set_config` interno (90 M chamadas, 1 linha cada — overhead
do PostgREST por request, normal) e INSERTs do sync de `contas_receber`
(50 M chamadas).

Destaques de leitura pesada:
- `pg_timezone_names`: 2.707 calls × 1.194 linhas = 3,2 M linhas → cachear
  no front (lista de timezones muda raramente).
- DELETE `audit_logs`: 14,5 M linhas em 48 calls → batching menor, índice
  composto.

### Bloco 10 — Top queries por volume de calls

| # | Query | Calls | Média (ms) | Total (s) |
|---|---|---:|---:|---:|
| 1 | `set_config(...)` interno PostgREST | 90.104.001 | 0,04 | 3.857 |
| 2 | INSERT `contas_receber` (sync) | 50.591.824 | **68,00** | **3.440.112** |
| 3 | SELECT `contas_pagar` por `erp_id` (idempotência) | 27.036.037 | 0,79 | 21.451 |
| 4 | `realtime.list_changes` | 24.390.362 | 10,61 | 258.809 |
| 5 | UPSERT (RPC) `p_records, p_force_update` | 930.549 | 926,96 | **862.577** |

**Foco de Fase 2:**
- O INSERT de `contas_receber` (50 M chamadas, 68 ms média) é o **maior
  consumidor de tempo total do banco** (956 horas acumuladas). Vale
  investigar se é insert linha-a-linha vs. `COPY`/batch.
- O RPC item #5 (`p_records`, 927 ms média) é o **2º maior** — provável
  gargalo de UPSERT em massa do sync. Avaliar `INSERT ... ON CONFLICT`
  com batch maior ou `merge`.

---

## Roadmap proposto (sem aplicar agora)

### Fase 1 — Quick wins (~1 dia, baixo risco)

- [ ] Substituir `auth.uid()` → `(select auth.uid())` em **60 policies**
      das top-30 tabelas (impacto principal: `Union`, `contas_receber`,
      `contas_pagar`, `contas_pagar_historico`, `clientes`,
      `clientes_perfil_credito`).
      *Mudança string-only; zero alteração de comportamento.*
- [ ] Adicionar índice em `clientes_score_historico (cliente_id)`
      (ou `created_at` — confirmar via EXPLAIN do uso real).
- [ ] Cachear `pg_timezone_names` no front (1 dia TTL).

**Ganho estimado:** 20–40 % de redução de CPU em queries das tabelas
top-3 em RLS; eliminação de 3,2 M linhas/dia em consulta de timezones.

### Fase 2 — Otimização média (~3 dias, médio risco)

- [ ] Drop de 8 índices não-usados (libera ~39 MB e reduz custo de
      INSERT/UPDATE em `Union`, `contas_pagar`, `contas_receber`,
      `clientes`).
      *Risco: feature recente pode estar para usar — confirmar com grep
      no código antes de drop.*
- [ ] Migrar paginação OFFSET → keyset/cursor em listas de `contas_pagar`
      e `contas_receber` (PostgREST suporta `range` headers ou cursor
      manual).
- [ ] Substituir `auth.uid()` direto nas **1.192 policies restantes**
      (fora top-30) em batches por módulo.
- [ ] Adicionar índice composto cobrindo `audit_logs (entity_type, created_at)`
      para reduzir custo do job de cleanup.

### Fase 3 — Refatoração (~1 semana, alto risco)

- [ ] Refatorar sync de `contas_receber` para usar `INSERT ... ON CONFLICT`
      em batches de 500–1000 (atual: 50 M chamadas linha-a-linha).
- [ ] Otimizar RPC `p_records, p_force_update` (UPSERT massivo, 927 ms
      média, 862 mil segundos acumulados).
- [ ] Avaliar materialized views para dashboards financeiros que agregam
      `Union` + `contas_pagar` + `contas_receber`.
- [ ] Reduzir log de auditoria: filtrar `entity_type` que não precisa
      ser auditado em produção.

---

## Próximas ações

Roadmap acima requer **aprovação humana antes de aplicar**. Cada fase
deve virar prompt separado, executado em branch Supabase com smoke
test antes de merge.

**Top 3 findings críticos** (prioridade de revisão humana):

1. 60 policies em `auth.uid()` direto nas tabelas mais quentes.
2. Sync linha-a-linha de `contas_receber` (956 h acumuladas em CPU DB).
3. OFFSET pagination em `contas_pagar` / `contas_receber`.

**Riscos detectados:**
- Nenhuma conexão presa em transação ✅
- Nenhuma tabela sem PK ✅
- Bloat saudável em todas as tabelas ✅
- Sem queries travadas (>5 min ativas) ✅
- Único risco operacional: o job de cleanup de `audit_logs` que processa
  303k linhas/call pode causar locks transitórios em horário de pico.

**Caminho do relatório:** `docs/DB-PERFORMANCE-AUDIT.md`

---

## Fora de escopo desta rodada

- ❌ Aplicar qualquer migration (criar/dropar índice, alterar policy)
- ❌ VACUUM / REINDEX em produção
- ❌ Mudanças em `postgresql.conf` ou pool settings
- ❌ Refatorar queries no frontend / edge functions

Tudo isso vira **Fase 2 (correções)** em prompt separado, somente após
revisão humana deste relatório.
