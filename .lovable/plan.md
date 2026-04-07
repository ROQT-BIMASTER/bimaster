

# Diagnóstico e Correção — Métricas Instagram/Facebook não carregam

## Problema identificado

A função `fetchInstagramMetrics` (linha 122) descarta a resposta de erro da API da Meta. Quando o token é rejeitado, o sistema mostra apenas "Verifique seu token" sem dizer **por quê**.

Causas prováveis do erro 400 da Meta:
- Token é de Página do Facebook, não de Instagram User Token
- Token expirado ou com escopo insuficiente
- Endpoint incorreto (`graph.instagram.com/me` requer Instagram User Access Token)

## Correção

### `supabase/functions/social-media-metrics/index.ts`

1. **Capturar erro detalhado da Meta** em todas as funções `fetch*Metrics`:
   - Quando `response.ok === false`, ler o body JSON da resposta
   - Logar `error.message`, `error.type`, `error.code` da Meta
   - Incluir a mensagem da Meta no erro retornado ao frontend

2. **Fallback de endpoint para Instagram**:
   - Se `graph.instagram.com/me` falhar, tentar via Facebook Graph API: `graph.facebook.com/me/accounts` para descobrir a Page ID vinculada, depois buscar a Instagram Business Account via `?fields=instagram_business_account`
   - Isso cobre o caso comum onde o usuário tem um Page Token ao invés de Instagram User Token

3. **Retornar diagnóstico claro ao frontend**:
   - Ex: "Token expirado (code 190)", "Permissão instagram_basic ausente", "Este token é de Página, não de Instagram"

### Exemplo da mudança principal

```typescript
// ANTES (linha 122-124)
if (!response.ok) {
  throw new Error('Erro ao buscar métricas do Instagram...');
}

// DEPOIS
if (!response.ok) {
  const errorBody = await response.json().catch(() => ({}));
  const metaError = errorBody?.error;
  console.error('Meta API error:', JSON.stringify(metaError));
  throw new Error(
    `Instagram API: ${metaError?.message || response.statusText} (code: ${metaError?.code || response.status})`
  );
}
```

## Arquivo alterado

| Arquivo | Alteração |
|---|---|
| `supabase/functions/social-media-metrics/index.ts` | Capturar e retornar erro detalhado da Meta em todas as funções fetch, adicionar fallback Facebook→Instagram Business Account |

