

# Correcao 12 — Error Handling Robusto + Contexto AI Corrigido

## Diagnostico

O erro `22P02: invalid input syntax for type bigint: "uuid-do-fornecedor"` ja esta tratado no `/incluir` do CP (deploy `_1336`). O screenshot mostra resultado do deploy anterior (`_1334`). Porem, ha 4 problemas residuais:

1. **`api-support-ai/index.ts`**: Contexto do assistente AI ainda usa `"uuid-do-fornecedor"` (string) — o chatbot sugere exemplos errados aos usuarios
2. **`contas-receber-api/index.ts`**: Zero tratamento de constraint errors (22P02, 23503, 23505, 23502) — tudo cai no catch global como 500
3. **`contas-pagar-api/index.ts` — upsert/upsert-lote**: O `throw error` na linha 2327 nao trata constraints — upsert com dados invalidos retorna 500
4. **`contas-pagar-api/index.ts` — global handler**: O catch final (linha 2622) nao verifica codigos Postgres antes de retornar 500

## Alteracoes

### 1. `supabase/functions/api-support-ai/index.ts`
- Substituir `"uuid-do-fornecedor"` por `12345` (numero) no contexto de exemplos (linha 73)

### 2. `supabase/functions/contas-receber-api/index.ts`
Adicionar tratamento de constraint errors no catch global (antes do `return 500`):
```typescript
const pgCode = error?.code || (typeof error === 'object' && 'code' in error ? error.code : null);
if (pgCode === '22P02') return jsonResponse({ error: 'Formato inválido...', codigo_status: '1' }, 400, corsHeaders);
if (pgCode === '23503') return jsonResponse({ error: 'Referência inválida...', codigo_status: '1' }, 400, corsHeaders);
if (pgCode === '23505') return jsonResponse({ error: 'Registro duplicado...', codigo_status: '2' }, 409, corsHeaders);
if (pgCode === '23502') return jsonResponse({ error: 'Campo obrigatório ausente...', codigo_status: '1' }, 400, corsHeaders);
```

### 3. `supabase/functions/contas-pagar-api/index.ts` — Global Handler
Mesmo padrao: adicionar verificacao de codigos Postgres no catch global (linha 2622) ANTES do `return 500`:
```typescript
const pgCode = error?.code;
if (pgCode === '22P02') return Response(... status 400);
if (pgCode === '23503') return Response(... status 400);
if (pgCode === '23505') return Response(... status 409);
if (pgCode === '23502') return Response(... status 400);
```
Isso protege TODOS os endpoints (upsert, upsert-lote, alterar, etc.) de uma vez.

### 4. Deploy
Deploy de: `api-support-ai`, `contas-receber-api`, `contas-pagar-api`.

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/api-support-ai/index.ts` | `codigo_cliente_fornecedor` de string para numero |
| `supabase/functions/contas-receber-api/index.ts` | Constraint error handling no catch global |
| `supabase/functions/contas-pagar-api/index.ts` | Constraint error handling no catch global |

## Impacto
- Nenhum endpoint existente quebra — apenas erros que antes retornavam 500 passam a retornar 400/409 com mensagens descritivas
- O assistente AI para de sugerir exemplos com strings em campos bigint

