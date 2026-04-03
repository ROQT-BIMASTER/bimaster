

# Diagnóstico: Sync Incompleta — Apenas 3.000 de 351.000 Registros por Ciclo

## Dados no Banco Hoje

| Ano | Total | Recebido | Pendente | Vencido | Parcial | Valor Total |
|---|---|---|---|---|---|---|
| 2026 | 72.922 | 44.528 | 25.680 | 2.504 | 210 | R$ 119M |
| 2025 | 172.543 | 169.941 | 0 | 2.339 | 263 | R$ 248M |
| **Total** | **351.193** | — | — | — | — | — |

Não há duplicatas — 245.465 registros únicos para 2025+2026 com `erp_id` correto.

## Problema Crítico Encontrado

**O `erp-sync-engine` processa apenas ~3.000 registros por execução** (2 páginas de 2.000). O edge function atinge o timeout do Supabase (~60-150s) antes de completar as ~175 páginas necessárias.

Cada execução do pg_cron (a cada 40 min):
1. Conecta ao SQL Server
2. Lê página 1 (linhas 1-2000) → upsert OK
3. Lê página 2 (linhas 2001-3000) → upsert OK
4. **Timeout** — registros das posições 3001+ nunca são atualizados

Isso significa que **pagamentos novos e alterações de status** em títulos que estão depois da posição 3000 na view **não são refletidos no BiMaster**.

A carga inicial de 351k veio do N8N (legado), que não tinha esse limite.

## Solução Proposta

### Abordagem: Sync Segmentada por Empresa

Em vez de paginar a view inteira (351k rows), fazer **uma chamada por empresa_id**. Cada empresa tem no máximo ~40k registros, processáveis dentro do timeout.

**Alterações no `erp-sync-engine/index.ts`:**

1. Nova rota `sync-contas-receber-por-empresa` que recebe `empresa_id` no body
2. Query SQL filtrada: `WHERE [ID Empresa] = @empresaId`
3. Rota `sync-contas-receber` vira orquestrador que chama empresa por empresa via `fetch` interno (cada uma como request separada, dentro do timeout)

**Alteração no pg_cron:**
- Em vez de uma única chamada, criar um job que chama a rota para cada empresa sequencialmente, ou criar jobs separados por empresa com intervalos de 2-3 minutos entre eles

### Alternativa: Sync Incremental Real

Adicionar filtro temporal na query SQL Server:
```sql
WHERE [Pigto de dados] >= DATEADD(HOUR, -1, GETDATE())
   OR [Vencimento] >= DATEADD(DAY, -1, GETDATE())
```

Isso reduziria o volume para ~500-2000 registros por ciclo, processáveis em segundos.

### Plano de Execução

| Passo | Descrição |
|---|---|
| 1 | Adicionar rota `sync-contas-receber-por-empresa` com filtro `WHERE [ID Empresa] = X` |
| 2 | Criar rota `sync-contas-receber-full` que itera por todas as empresas chamando a rota acima |
| 3 | Adicionar rota `sync-contas-receber-incremental` com filtro temporal (últimas 2 horas) |
| 4 | Atualizar pg_cron: incremental a cada 40 min, full 1x/dia (madrugada) |
| 5 | Executar sync full para garantir 100% dos dados atualizados |
| 6 | Validação cruzada dos totais por status/empresa |

### Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/erp-sync-engine/index.ts` | Novas rotas por empresa + incremental |
| pg_cron (SQL) | Ajustar jobs para nova estratégia |

