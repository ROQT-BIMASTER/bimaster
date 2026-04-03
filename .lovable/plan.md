

# Fix Crítico: erp_id Incorreto + 133k Duplicatas + pg_cron Nunca Executou

## Diagnóstico Completo

### Problema 1 (CRÍTICO): erp_id com formato errado — 133.861 duplicatas

O `erp-sync-engine` gera erp_id com **4 campos**: `empresa-tipo-nota-seq`
Mas os dados originais (N8N) usam **5 campos**: `empresa-tipo-nota-seq-código`

```text
CORRETO (N8N):   4-1-132710-2-20108  (5 campos, inclui código do cliente)
ERRADO (Engine): 4-1-132710-2        (4 campos, sem código)
```

Resultado: o upsert **não encontra** o registro existente (erp_id diferente) e **insere duplicata**. Há 133.861 registros duplicados no banco:

| Formato | Registros |
|---------|-----------|
| 5 campos (correto) | 339.199 |
| 4 campos (duplicatas) | 133.861 |
| **Total inflado** | **473.060** |

O total real deveria ser ~339k. Os dashboards mostram valores financeiros inflados.

### Problema 2: pg_cron jobs NUNCA executaram

Os 59 jobs `sync-cr-*` (IDs 31-91) têm **zero registros** em `cron.job_run_details`. Foram criados após o horário de 03:00 UTC de hoje, então a primeira execução será amanhã. Porém, o job incremental (ID 91, `10,50 0-2,5-23 * * *`) também não executou — precisa ser verificado se vai funcionar na próxima janela (:10 ou :50).

### Problema 3: N8N ainda chamando endpoint morto

Logs mostram chamadas `POST /contas-receber-api/sync?force_update=true` retornando **404** a cada ~15 segundos. O workflow N8N externo ainda está ativo. Não há job pg_cron para isso (é externo), mas gera ruído nos logs.

### Problema 4: contas_pagar com prefixo CP- no engine

O engine gera `CP-empresa-tipo-nota-seq` (4 campos + prefixo), mas os dados existentes usam `empresa-tipo-nota-seq-código` (5 campos sem prefixo). Felizmente o engine nunca executou sync de contas_pagar via pg_cron, então não há duplicatas lá.

## Plano de Correção

### Correção 1: Corrigir erp_id no erp-sync-engine

**Arquivo**: `supabase/functions/erp-sync-engine/index.ts`

Linha 113 (contas_receber):
```typescript
// ANTES:
const erpId = `${empresaId}-${tipo}-${nota}-${seq}`.replace(/\s+/g, "");

// DEPOIS:
const codigo = row["Código"] || row["Codigo"] || "";
const erpId = `${empresaId}-${tipo}-${nota}-${seq}-${codigo}`.replace(/\s+/g, "");
```

Linha 158 (contas_pagar) — remover prefixo CP e adicionar código:
```typescript
// ANTES:
const erpId = `CP-${empresaId}-${tipo}-${nota}-${seq}`.replace(/\s+/g, "");

// DEPOIS:
const codigo = row["Código"] || row["Codigo"] || "";
const erpId = `${empresaId}-${tipo}-${nota}-${seq}-${codigo}`.replace(/\s+/g, "");
```

### Correção 2: Limpar 133k duplicatas (4 campos)

Executar via SQL INSERT tool (não migration):
```sql
DELETE FROM contas_receber 
WHERE array_length(string_to_array(erp_id, '-'), 1) = 4;
```

### Correção 3: Validar contagem pós-limpeza

Verificar que o total volta a ~339k e os totais financeiros estão corretos.

## Arquivos Alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/erp-sync-engine/index.ts` | Corrigir erp_id: adicionar código como 5º campo em ambos os transformers |
| Banco de dados (DELETE) | Remover 133.861 registros duplicados com erp_id de 4 campos |

## Resultado Esperado

- Zero duplicatas — erp_id com 5 campos (igual ao formato original)
- Total ~339k registros (correto)
- Upserts futuros vão atualizar registros existentes (não criar novos)
- pg_cron vai rodar amanhã às 03:00 UTC com o formato correto
- Incremental vai rodar na próxima janela (:10 ou :50 da hora)

