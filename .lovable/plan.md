

# Correção: PUT /update retornando "Failed to fetch" (erro CORS)

## Problema

O browser envia um preflight OPTIONS antes de requisições PUT. O header `Access-Control-Allow-Methods` não está presente na resposta CORS do `contas-pagar-api`, então o browser bloqueia a requisição PUT.

## Correção

### 1. Adicionar `Access-Control-Allow-Methods` nos CORS headers (`contas-pagar-api/index.ts`)

Adicionar ao objeto `corsHeaders` na linha 6-9:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
```

Isso permite que o preflight OPTIONS autorize métodos PUT/PATCH/DELETE.

### 2. Melhorar tratamento de erro no API Tester (`ApiTester.tsx`)

Atualmente, quando `fetch` falha com erro de rede (CORS block), o catch não mostra mensagem útil. Melhorar para indicar que pode ser problema de CORS.

### Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/contas-pagar-api/index.ts` | +1 linha: `Access-Control-Allow-Methods` |
| `src/components/erp/ApiTester.tsx` | Melhorar mensagem de erro de rede |

