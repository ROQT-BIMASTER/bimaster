

# Auditoria Completa das APIs ERP — Pontos de Melhoria

## Resumo Executivo

Foram analisadas **todas as 7 Edge Functions ERP** e os helpers compartilhados. Identificados **19 pontos de melhoria** em 5 categorias: segurança, padronização, resiliência, observabilidade e manutenibilidade.

---

## 1. SEGURANÇA — Problemas Críticos

### 1.1 CORS aberto em 5 de 7 APIs
As seguintes APIs usam `Access-Control-Allow-Origin: *` em vez do helper seguro `_shared/cors.ts`:

| API | CORS |
|---|---|
| `contas-pagar-api` | `*` (aberto) |
| `contas-pagar-export-api` | `*` (aberto) |
| `contas-receber-api` | `*` (aberto) |
| `erp-export-payment` | `*` (aberto) |
| `estoque-api` | `*` (aberto) |
| `erp-webhook-inbound` | ✅ Usa `_shared/cors.ts` |
| `erp-fornecedores-query` | `*` (aberto) |
| `erp-portadores-api` | `*` (aberto) |
| `erp-plano-contas-api` | `*` (aberto) |

**Risco**: Qualquer site pode chamar essas APIs do navegador. Para APIs server-to-server (ERP) isso é aceitavel, mas as APIs que servem o frontend (export-payment, estoque) precisam de CORS restrito.

**Correção**: Migrar todas as APIs para usar `getCorsHeaders(req)` de `_shared/cors.ts`.

### 1.2 Comparação de API key sem timing-safe em 4 APIs
As APIs `contas-pagar-api`, `contas-pagar-export-api`, `estoque-api` e `erp-export-payment` usam `apiKey === expectedKey` (comparação direta), vulnerável a timing attacks.

**Correção**: Usar `timingSafeEqual` de `_shared/timing-safe.ts`.

### 1.3 Security headers ausentes em 6 APIs
Apenas `erp-webhook-inbound` usa `handleError` (que inclui security headers). As demais não incluem `X-Content-Type-Options`, `X-Frame-Options`, etc.

**Correção**: Usar `withSecurityHeaders()` de `_shared/security-headers.ts` em todas as respostas.

### 1.4 `estoque-api` sem fallback `erp_api_keys`
A API de estoque ainda só aceita `EXPORT_API_KEY` fixa, sem fallback para o Portal de Integração.

**Correção**: Adicionar fallback `validateErpApiKey`.

### 1.5 `erp-export-payment` sem fallback `erp_api_keys`
Só aceita JWT. Sem suporte a API keys do Portal.

**Correção**: Se o ERP precisar chamar, adicionar suporte a `x-api-key`.

---

## 2. PADRONIZAÇÃO — Inconsistências entre APIs

### 2.1 Imports misturados
| API | Import style |
|---|---|
| `contas-pagar-api` | `https://esm.sh/@supabase/supabase-js@2.38.4` |
| `contas-receber-api` | `https://esm.sh/@supabase/supabase-js@2.38.4` |
| `erp-webhook-inbound` | `https://esm.sh/@supabase/supabase-js@2` |
| `erp-fornecedores-query` | `https://esm.sh/@supabase/supabase-js@2` |
| `contas-pagar-export-api` | `npm:@supabase/supabase-js@2` |
| `_shared/auth.ts` | `npm:@supabase/supabase-js@2` |

**Risco**: Versões diferentes podem causar comportamentos inconsistentes. O `esm.sh` com versão fixa pode ter hashes obsoletos no `deno.lock`.

**Correção**: Padronizar todas para `npm:@supabase/supabase-js@2`.

### 2.2 CORS headers inconsistentes
Algumas APIs listam `x-api-key` nos headers permitidos, outras não. Exemplo: `estoque-api` não inclui `x-api-key` nos headers CORS mas aceita esse header na autenticação.

### 2.3 Formato de resposta inconsistente
| API | Formato de erro |
|---|---|
| `erp-fornecedores-query` | `{ error: "CODE", message: "..." }` |
| `contas-pagar-api` | `{ error: "..." }` |
| `contas-pagar-export-api` | `{ error: "..." }` |
| `erp-webhook-inbound` | `{ sucesso: false, erro: "...", mensagem: "..." }` |

**Correção**: Adotar formato unificado: `{ error: string, message: string, code?: number }`.

---

## 3. RESILIÊNCIA — Riscos de Falha

### 3.1 Sem rate limiting em 5 APIs
Apenas `erp-webhook-inbound` e `contas-pagar-api` implementam rate limiting. As demais são vulneráveis a abuso.

| API | Rate Limit |
|---|---|
| `erp-webhook-inbound` | ✅ 60 req/min |
| `contas-pagar-api` | ✅ Slot-based |
| `contas-pagar-export-api` | ❌ Nenhum |
| `erp-fornecedores-query` | ❌ Nenhum |
| `erp-portadores-api` | ❌ Nenhum |
| `erp-plano-contas-api` | ❌ Nenhum |
| `contas-receber-api` | ❌ Nenhum |

**Correção**: Adicionar `checkRateLimit` de `_shared/rate-limit.ts` nas APIs sem proteção.

### 3.2 Sem limite de payload em APIs de sync
`erp-portadores-api` POST /sync e `contas-receber-api` sync aceitam arrays ilimitados. Um payload de 100k registros pode derrubar a função.

**Correção**: Limitar arrays a um máximo (ex: 5000 registros por request).

### 3.3 Sem timeout em queries
Nenhuma API define timeout nas queries ao banco. Uma query lenta pode travar a função até o timeout do Edge Runtime (150s).

---

## 4. OBSERVABILIDADE — Gaps de Monitoramento

### 4.1 Logging inconsistente
`contas-pagar-api` tem logging detalhado com timestamps. As APIs menores (fornecedores, portadores, plano de contas) logam para `erp_sync_log` mas sem `duration_ms` consistente.

### 4.2 Sem métricas de latência nas respostas
Apenas `contas-pagar-api` retorna métricas de performance. As demais não incluem `duration_ms` ou `processed_at` nas respostas.

**Correção**: Incluir `{ ..., meta: { duration_ms, processed_at } }` em todas as respostas.

---

## 5. MANUTENIBILIDADE — Dívida Técnica

### 5.1 Autenticação duplicada em cada função
Cada API reimplementa a lógica de autenticação (hash, query erp_config, fallback). Deveria usar o helper centralizado `_shared/auth.ts` com `validateApiKey()`.

### 5.2 Helper `_shared/auth.ts` não faz fallback para `erp_api_keys`
O helper `validateApiKey` em `_shared/auth.ts` só consulta `erp_config`. O fallback para `erp_api_keys` deveria estar nele, não duplicado em cada função.

**Correção**: Adicionar fallback `validateErpApiKey` no `validateApiKey` de `_shared/auth.ts`, e migrar todas as funções para usar esse helper único.

---

## Plano de Implementação (Priorizado)

### Fase 1 — Segurança (Crítico)
1. **Centralizar auth**: Adicionar fallback `erp_api_keys` no `_shared/auth.ts` → `validateApiKey()`
2. **Migrar todas as APIs** para usar `validateApiKey()` e `validateJWT()` do helper
3. **CORS**: Migrar APIs que servem frontend para `_shared/cors.ts`
4. **Timing-safe**: Remover comparações `===` de API keys
5. **Security headers**: Adicionar `withSecurityHeaders()` em todas as respostas

### Fase 2 — Resiliência
6. **Rate limiting**: Adicionar `checkRateLimit()` nas 5 APIs sem proteção
7. **Payload limits**: Limitar tamanho de arrays em POST /sync
8. **Padronizar imports**: Migrar tudo para `npm:@supabase/supabase-js@2`

### Fase 3 — Observabilidade
9. **Response metadata**: Adicionar `duration_ms` e `processed_at` nas respostas
10. **Formato de erro unificado**: Padronizar estrutura de erro

### Arquivos Impactados

| Arquivo | Mudanças |
|---|---|
| `_shared/auth.ts` | Adicionar fallback `erp_api_keys` no `validateApiKey` |
| `erp-fornecedores-query/index.ts` | Migrar para helper auth, CORS, rate limit, security headers |
| `erp-portadores-api/index.ts` | Idem + limite de payload no POST /sync |
| `erp-plano-contas-api/index.ts` | Migrar para helper auth, CORS, rate limit |
| `contas-pagar-export-api/index.ts` | CORS restrito, timing-safe, rate limit |
| `contas-receber-api/index.ts` | Limite de payload, rate limit, padronizar import |
| `estoque-api/index.ts` | Fallback erp_api_keys, CORS, timing-safe |
| `erp-export-payment/index.ts` | Timing-safe (se aplicável), security headers |
| `contas-pagar-api/index.ts` | Timing-safe na comparação N8N_API_KEY, security headers |

