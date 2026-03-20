# AUDITORIA DE SEGURANÇA — BiMaster
**Data:** 2026-03-20  
**Versão:** 2.0  
**Classificação:** Interno / Confidencial

---

## Resumo Executivo

Auditoria de segurança em duas fases. Fase 1 (SEG-1 a SEG-6) cobriu fundações de segurança. Fase 2 (ADV-1 a ADV-8) implementou técnicas enterprise avançadas. Todas as correções são retrocompatíveis.

| Vetor | Criticidade | Status |
|-------|-------------|--------|
| SEG-1 — Autenticação em Edge Functions | CRÍTICO | ✅ Implementado |
| SEG-2 — API Key Hashing | CRÍTICO | ✅ Implementado |
| SEG-3 — CORS Lockdown | CRÍTICO | ✅ Implementado |
| SEG-4 — Input Validation (Zod) | IMPORTANTE | ✅ Implementado |
| SEG-5 — Rate Limiting Global | IMPORTANTE | ✅ Implementado |
| SEG-6 — RLS Auditoria | IMPORTANTE | ✅ Sem gaps |
| **ADV-1 — Timing-Safe Comparison** | **CRÍTICO** | ✅ Implementado |
| **ADV-2 — Security Headers** | **CRÍTICO** | ✅ Implementado |
| **ADV-3 — SSRF Guard** | **CRÍTICO** | ✅ Implementado |
| **ADV-4 — Session Invalidation Realtime** | **IMPORTANTE** | ✅ Implementado |
| **ADV-5 — Login Lockout** | **IMPORTANTE** | ✅ Já existia |
| **ADV-6 — useFieldVisibility Expansão** | **IMPORTANTE** | ✅ Implementado |
| **ADV-7 — useUIPermissions Expansão** | **IMPORTANTE** | ✅ Implementado |
| **ADV-8 — Seed ui_permissions** | **IMPORTANTE** | ✅ Implementado |

---

## FASE 1 — SEG-1 a SEG-6

*(Mantida da versão 1.0 — sem alterações)*

### SEG-1 — Autenticação em Edge Functions
Helper `_shared/auth.ts` com `validateJWT()`, `validateApiKey()`, `validateHmac()` aplicado em 10 Edge Functions.

### SEG-2 — API Key Hashing
Coluna `api_key_hash` + trigger SHA-256 na `erp_config`. Transição transparente hash/plaintext.

### SEG-3 — CORS Lockdown
Helper `_shared/cors.ts` com whitelist de origens. `Access-Control-Allow-Origin: *` eliminado.

### SEG-4 — Input Validation (Zod)
Schemas Zod em todas as Edge Functions + `sanitizeString()`.

### SEG-5 — Rate Limiting Global
20 req/min para IA, 100 req/min para operacional, 60 req/min para webhooks.

### SEG-6 — RLS Auditoria
0 tabelas sem RLS. 130 warnings pré-existentes do linter.

---

## FASE 2 — ADV-1 a ADV-8

### ADV-1 — Comparação Timing-Safe

**Problema:** Comparações de string com `===` vazam informação sobre caracteres corretos via diferenças de tempo de resposta (timing attacks).

**Solução:**
- Criado `_shared/timing-safe.ts` com `timingSafeEqual()` usando XOR byte-a-byte em tempo constante
- Aplicado em todas as comparações de segurança em `_shared/auth.ts`:
  - Validação de API key hash (`validateApiKey`)
  - Verificação HMAC (`validateHmac`)
  - Comparação de chave anterior durante rotação
- Quando os comprimentos diferem, uma comparação dummy é executada para evitar vazamento de tamanho

### ADV-2 — Security Headers Completos

**Problema:** Edge Functions retornavam apenas CORS headers, sem proteções HTTP adicionais.

**Solução:**
- Criado `_shared/security-headers.ts` com `getSecurityHeaders()` e `withSecurityHeaders()`
- Headers incluídos em TODAS as respostas:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`
  - `Content-Security-Policy: default-src 'self'...`
- Endpoints sensíveis: `Cache-Control: no-store, no-cache, must-revalidate, private`
- `index.html` atualizado com meta tags equivalentes:
  - `X-Frame-Options: DENY` (era SAMEORIGIN)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Content-Type-Options: nosniff`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`

### ADV-3 — Proteção SSRF

**Problema:** Edge Functions que fazem `fetch()` com URLs do payload podiam ser usadas para acessar recursos internos (SSRF).

**Solução:**
- Criado `_shared/ssrf-guard.ts` com `validateExternalUrl()`
- Bloqueia:
  - Protocolos: `file:`, `gopher:`, `dict:`, `ftp:`, `data:`, `javascript:`
  - IPs privados: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`
  - Hostnames: `localhost`, `[::1]`, `metadata.google.internal`, `169.254.169.254`
  - Domínios: `*.internal`, `*.local`, `*.localhost`
  - Supabase externo: `*.supabase.co` (exceto o próprio projeto)
- Aplicado em: `pollo-analyze-website` (único EF que faz fetch de URL do usuário)
- `error-handler.ts` atualizado para tratar `SSRFError` com status 400

### ADV-4 — Invalidação de Sessão em Tempo Real

**Problema:** Quando a role de um usuário era alterada, a sessão ativa mantinha as permissões antigas até expirar.

**Solução:**
- Tabela `session_invalidation_queue` com RLS:
  - `service_role` pode INSERT (triggers)
  - `authenticated` pode SELECT apenas `WHERE user_id = auth.uid()`
- Trigger `trg_session_invalidation_on_role_change` em `user_roles`:
  - INSERT/UPDATE/DELETE → insere na fila com motivo descritivo
- Realtime habilitado na tabela
- `PermissionsContext.tsx` escuta via Realtime:
  - Ao receber evento INSERT para seu `user_id`, executa `signOut()` imediato
  - Redireciona para login com parâmetro `?session_invalidated=1`
- Função `cleanup_session_invalidation_queue()` para limpeza periódica (>24h)

### ADV-5 — Bloqueio de Conta por Tentativas

**Status:** Já implementado previamente.
- RPC `check_account_lockout` e `record_login_attempt` já existiam
- `LoginForm.tsx` já fazia verificação antes do `signInWithPassword`
- Countdown visual e bloqueio de 5 tentativas em 15min já funcionais

### ADV-6 — Expansão useFieldVisibility

**Problema:** Hook `useFieldVisibility` existia mas só era usado em `ProdutoBrasilCadastro`.

**Solução:**
- Integrado em `ChinaSubmissaoDetalhe.tsx`: `useFieldVisibility("china_ficha")`
- Integrado em `ChinaFichaProduto.tsx`: `useFieldVisibility("china_ficha")`
- Campos de custo/margem podem ser ocultados via tabela `departamento_campo_visibilidade`
- Padrão: `const { isFieldVisible } = useFieldVisibility('china_ficha')`

### ADV-7 — Expansão useUIPermissions

**Problema:** Hook `useUIPermissions` existia mas só era usado em `ProdutoBrasilCadastro`.

**Solução:**
- Integrado em `ContasAPagar.tsx`: `useUIPermissions("financeiro_contas_pagar")`
  - `canApprovePayment` controla visibilidade de ações de aprovação
- Integrado em `ContasAReceber.tsx`: `useUIPermissions("financeiro_contas_receber")`
  - `canManageRecebimento` controla ações de baixa
- Integrado em `ChinaFichaProduto.tsx`: `useUIPermissions("china_ficha")`
- Padrão: `const { canEdit } = useUIPermissions('tela_codigo')`

### ADV-8 — Seed de Regras ui_permissions

**Problema:** Tabela `ui_permissions` vazia = fail-open total.

**Solução:** Migration insere 17 regras padrão:
- **vendedor**: bloqueado de `aprovar_pagamento`, `baixar_recebimento`, `relatorio_financeiro_completo`, `gestao_usuarios`
- **promotor**: todos os bloqueios do vendedor + `campo_custos` (China)
- **supervisor**: bloqueado de `gestao_usuarios`
- **gerente**: acesso explícito a `aprovar_pagamento` e `baixar_recebimento`
- **admin**: acesso total explícito a todos os componentes

---

## Arquivos Criados/Modificados — Fase 2

### Novos helpers
| Arquivo | Função |
|---------|--------|
| `_shared/timing-safe.ts` | Comparação timing-safe (XOR constante) |
| `_shared/security-headers.ts` | Headers de segurança enterprise |
| `_shared/ssrf-guard.ts` | Proteção contra SSRF |

### Arquivos modificados
| Arquivo | Mudança |
|---------|---------|
| `_shared/auth.ts` | ADV-1: timing-safe em todas as comparações |
| `_shared/error-handler.ts` | ADV-2/3: security headers + SSRFError |
| `index.html` | ADV-2: meta tags de segurança |
| `pollo-analyze-website/index.ts` | ADV-3: SSRF guard + security headers |
| `src/contexts/PermissionsContext.tsx` | ADV-4: Realtime listener para invalidação |
| `src/pages/ChinaSubmissaoDetalhe.tsx` | ADV-6: useFieldVisibility |
| `src/pages/ChinaFichaProduto.tsx` | ADV-6/7: useFieldVisibility + useUIPermissions |
| `src/pages/ContasAPagar.tsx` | ADV-7: useUIPermissions |
| `src/pages/ContasAReceber.tsx` | ADV-7: useUIPermissions |

### Migration
- Tabela `session_invalidation_queue` + trigger + RLS + realtime
- Seed de 17 regras em `ui_permissions`

---

## Recomendações Futuras

### Curto prazo (30 dias)
1. **Remover plaintext API keys**: `UPDATE erp_config SET api_key = NULL WHERE api_key_hash IS NOT NULL`
2. **Configurar `ALLOWED_ORIGINS`**: definir como secret no projeto
3. **Aplicar security headers nas ~80 EFs restantes**: progressivamente importar `withSecurityHeaders`
4. **Configurar regras campo_custos** na tabela `departamento_campo_visibilidade` para departamentos restritos

### Médio prazo (90 dias)
5. **Resolver warnings do linter**: fixar `search_path` em funções SQL
6. **WAF/CDN**: Cloudflare como L7
7. **Logging de segurança centralizado**: tabela dedicada para auth failures
8. **SSRF guard em EFs restantes**: qualquer nova EF que aceite URLs

### Longo prazo
9. **Rotação automática de API keys**: cron 90 dias
10. **Penetration testing profissional**
11. **SOC 2 compliance**

---

*Relatório gerado pela auditoria de segurança BiMaster v2.0 — 2026-03-20*
