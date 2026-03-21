

# Hardening de Segurança — Todas as APIs do Portal de Integração

## Problemas Identificados na Auditoria

### 1. CORS Aberto (`Allow-Origin: *`)
~98 edge functions usam CORS hardcoded com `*` ao invés do helper `cors.ts` que faz whitelist de origens. Isso permite qualquer site fazer requests às APIs.

**Funções afetadas do Portal ERP:**
- `departamentos-api`, `contas-pagar-api`, `contas-receber-api`, `boletos-api` — CORS inline `*`
- As demais (tipos-*, bancos, clientes, projetos, etc.) já usam `handleCors` corretamente

### 2. Auth Inconsistente
| Função | Auth Atual | Problema |
|---|---|---|
| `tipos-anexo-api` | `validateApiKey` apenas | Sem suporte JWT |
| `tipos-entrega-api` | `validateApiKey` apenas | Sem suporte JWT |
| `tipos-atividade-api` | `validateApiKey` apenas | Sem suporte JWT |
| `tipos-documento-api` | `validateApiKey` apenas | Sem suporte JWT |
| `clientes-api` | `validateApiKey` apenas | Sem suporte JWT |
| `projetos-api` | `validateApiKey` apenas | Sem suporte JWT |
| `empresas-api` | `validateApiKey` apenas | Sem suporte JWT |
| `bancos-api` | `validateApiKey` apenas | Sem suporte JWT |
| `departamentos-api` | `validateApiKey` apenas | Sem suporte JWT, sem security headers |
| `contas-pagar-api` | Auth inline própria | Não usa helpers compartilhados |
| `contas-receber-api` | `validateAnyAuth` inline | OK mas CORS `*` |
| `contas-correntes-api` | `validateErpAuth` | OK, já robusto |
| `lancamentos-cc-api` | `validateErpAuth` | OK, já robusto |
| `movimentos-financeiros-api` | `validateAnyAuth` | OK, tem rate limit |

### 3. Sem Rate Limiting
As seguintes APIs do portal **não têm rate limiting**: tipos-anexo, tipos-entrega, tipos-atividade, tipos-documento, clientes, projetos, empresas, bancos, bandeiras, origens, departamentos, categorias, parcelas, paises, cidades, cnae, finalidades-transferencia, dre-cadastro, boletos, anexos.

### 4. Sem Security Headers
Funções com CORS inline não incluem headers de segurança (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).

## Plano de Implementação

### Etapa 1: Criar helper `validateAnyAuth` compartilhado em `_shared/auth.ts`

Adicionar ao `_shared/auth.ts` uma função `validateAnyAuth` que tenta JWT primeiro, depois API Key — padronizando a autenticação dual para todas as APIs do portal.

```typescript
export async function validateAnyAuth(req: Request): Promise<{
  userId?: string; empresaId?: string; source: "jwt" | "api_key";
}> {
  try {
    const jwt = await validateJWT(req);
    return { userId: jwt.userId, source: "jwt" };
  } catch {
    const key = await validateApiKey(req);
    return { empresaId: key.empresaId, source: "api_key" };
  }
}
```

### Etapa 2: Padronizar TODAS as 20+ APIs do portal

Para cada função, aplicar o mesmo padrão:
1. Importar `handleCors`, `getCorsHeaders` do `_shared/cors.ts`
2. Importar `withSecurityHeaders` do `_shared/security-headers.ts`
3. Usar `jsonResponse`/`errorResponse` do `_shared/response.ts`
4. Usar `validateAnyAuth` do `_shared/auth.ts` (JWT + API Key)
5. Adicionar `checkRateLimit` do `_shared/rate-limit.ts`
6. Status endpoint livre de auth (health check padrão)

**Funções a atualizar (20 funções):**
- `tipos-anexo-api` — adicionar JWT, rate limit
- `tipos-entrega-api` — adicionar JWT, rate limit
- `tipos-atividade-api` — adicionar JWT, rate limit
- `tipos-documento-api` — adicionar JWT, rate limit
- `clientes-api` — adicionar JWT, rate limit
- `projetos-api` — adicionar JWT, rate limit
- `empresas-api` — adicionar JWT, rate limit
- `bancos-api` — adicionar JWT, rate limit
- `bandeiras-api` — adicionar JWT, rate limit
- `origens-api` — adicionar JWT, rate limit
- `departamentos-api` — reescrever CORS + auth + headers + rate limit
- `categorias-api` — adicionar JWT, rate limit
- `parcelas-api` — adicionar JWT, rate limit
- `paises-api` — adicionar JWT, rate limit
- `cidades-api` — adicionar JWT, rate limit
- `cnae-api` — adicionar JWT, rate limit
- `finalidades-transferencia-api` — adicionar JWT, rate limit
- `dre-cadastro-api` — adicionar JWT, rate limit
- `boletos-api` — corrigir CORS (remover `*`)
- `anexos-api` — corrigir CORS (remover `*`)
- `contas-correntes-api` — adicionar status livre de auth
- `contas-receber-api` — corrigir CORS (remover `*`)

### Etapa 3: Atualizar `contas-pagar-api` (caso especial)

Esta função tem 2271 linhas com auth inline. A abordagem é cirúrgica:
- Substituir `corsHeaders` hardcoded por `getCorsHeaders(req)`
- Substituir auth inline pela importação de `validateAnyAuth`
- Adicionar security headers nas respostas

### Etapa 4: Atualizar documentação do portal

No `ApiDocumentation.tsx`, adicionar seção de segurança visível:
- Badge "JWT + API Key" em cada endpoint
- Indicador de rate limit (60 req/min)
- Headers de segurança listados
- Exemplo de autenticação JWT

### Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/_shared/auth.ts` | Adicionar `validateAnyAuth` |
| 20+ `supabase/functions/*/index.ts` | Padronizar auth, CORS, rate limit, security headers |
| `src/components/erp/ApiDocumentation.tsx` | Adicionar seção de segurança |

### Nota sobre N8N

As APIs internas do N8N (`contas-pagar-api/sync`, `contas-pagar-api/bulk-sync`, `contas-receber-api/sync`, `n8n-contas-receber`, `estoque-n8n-sync`) continuam funcionando normalmente via `x-api-key` — o `validateAnyAuth` suporta ambos os métodos.

