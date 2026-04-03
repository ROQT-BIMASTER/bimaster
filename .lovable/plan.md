

# Eliminar N8N — Sync 100% via erp-sync-engine

## Situação Atual

### Problema 1: N8N ainda está ativo e enviando dados
Os logs confirmam que `contas-receber-api` continua recebendo batches de 3000 registros do N8N a cada poucos segundos. Isso causa:
- Conflito com o `erp-sync-engine` (ambos fazendo upsert na mesma tabela simultaneamente)
- Deadlocks detectados nos logs (`❌ Upsert error batch 600: deadlock detected`)
- Desperdício de recursos e risco de status inconsistentes (N8N usa lógica de status diferente)

### Problema 2: erp-sync-engine ainda tem gargalo de performance
Cada página abre uma **nova conexão SQL Server** (linhas 357-386). Com overhead de ~5-10s por conexão × 30 páginas = tempo impossível. Empresas grandes (4, 11, 6, 3) sempre dão `partial` com time guard.

### Problema 3: Frontend ainda referencia funções legadas
- `useContasReceberSync.ts` chama `n8n-contas-receber/sync-auto` e `contas-receber-api`
- `useN8NSync.ts` inteiro é dedicado ao fluxo N8N
- `ContasReceberSyncPanel.tsx` oferece modo `n8n` vs `direct`

## Plano de Execução

### Passo 1: Corrigir performance do erp-sync-engine (conexão reutilizada)

Refatorar `handleSyncPaginated` para abrir **uma única conexão SQL** e reutilizá-la em todas as páginas. Isso elimina o overhead de 5-10s por página, permitindo processar ~20k registros em ~60s em vez de 8k.

```text
ANTES: conectar → query → fechar → conectar → query → fechar (×30)
DEPOIS: conectar → query → query → query (×30) → fechar
```

### Passo 2: Remover edge functions legadas do N8N

Deletar os arquivos:
- `supabase/functions/n8n-contas-receber/index.ts`
- `supabase/functions/contas-receber-api/index.ts`

Isso mata imediatamente o endpoint que o N8N usa para enviar dados, forçando o uso exclusivo do `erp-sync-engine`.

### Passo 3: Atualizar hooks do frontend

**`useContasReceberSync.ts`**: Remover `SyncMode` (n8n/direct), remover `syncN8n()`, e atualizar `syncDirect()` e `testErpConnection()` para chamar `erp-sync-engine` em vez de `contas-receber-api`. Manter `fetchStats()` e `fetchSyncHistory()` (já consultam banco direto).

**`useN8NSync.ts`**: Marcar como deprecated ou remover se nenhum componente crítico depende dele.

### Passo 4: Atualizar ContasReceberSyncPanel

Remover toggle N8N/Direct. O painel mostra apenas o modo direto (erp-sync-engine) com botões:
- "Sync Full" → chama `sync-contas-receber-full`
- "Sync Incremental" → chama `sync-contas-receber-incremental`
- "Sync Empresa X" → chama `sync-contas-receber-por-empresa`

### Passo 5: Limpar pg_cron jobs legados

Verificar e remover qualquer job que ainda chame `n8n-contas-receber` ou `contas-receber-api`.

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/erp-sync-engine/index.ts` | Reutilizar conexão SQL dentro de `handleSyncPaginated` |
| `supabase/functions/n8n-contas-receber/index.ts` | **DELETAR** |
| `supabase/functions/contas-receber-api/index.ts` | **DELETAR** |
| `src/hooks/useContasReceberSync.ts` | Remover modo N8N, apontar para erp-sync-engine |
| `src/hooks/useN8NSync.ts` | **DELETAR** ou esvaziar |
| `src/components/financeiro/ContasReceberSyncPanel.tsx` | Remover toggle N8N, simplificar |
| `src/pages/financeiro/ContasReceberSyncPage.tsx` | Remover import de useN8NSync |
| `src/components/financeiro/SyncMonitorPanel.tsx` | Atualizar botão para usar erp-sync-engine |
| pg_cron (SQL) | Remover jobs legados |

## Resultado Esperado

- Zero dependência do N8N para Contas a Receber
- Sync full diário processa 100% dos 351k registros (via jobs por empresa)
- Incremental a cada 40 min processa apenas pagamentos recentes (~500-2000 registros)
- Sem deadlocks (uma única engine fazendo upserts)
- Frontend unificado sem opção N8N

