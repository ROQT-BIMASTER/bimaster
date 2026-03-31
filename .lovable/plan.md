

# Análise: Backend Seguro — Contexto Lovable Cloud

## Realidade do Projeto

Este projeto roda no **Lovable Cloud** (Supabase), que é uma plataforma serverless. **Não é possível** adicionar um servidor Node.js tradicional (Express, Fastify, etc.) ao projeto. O sandbox não executa servidores persistentes.

Porém, a boa notícia: **a maioria dos requisitos já está implementada ou pode ser implementada** usando a arquitetura existente (Edge Functions + RLS + Supabase Auth).

## Mapeamento: Requisito → Status Atual

| Requisito | Status | Implementação |
|-----------|--------|---------------|
| JWT (access + refresh) | ✅ Nativo | Supabase Auth gerencia automaticamente |
| Hash bcrypt | ✅ Nativo | Supabase Auth usa bcrypt internamente |
| Middleware de token | ✅ Implementado | `_shared/auth.ts` com `validateAny` |
| RBAC | ✅ Implementado | `user_roles` + `has_role()` + RLS |
| Permissões granulares | ✅ Implementado | `usuario_permissoes_modulos/telas` + ABAC |
| SQL Injection | ✅ Protegido | Supabase SDK usa prepared statements |
| Validação Zod | ✅ Implementado | `_shared/validate.ts` |
| XSS | ⚠️ Parcial | CSP headers existem, sanitização parcial |
| CSRF | ✅ Nativo | JWT-based auth não usa cookies |
| Mass Assignment | ⚠️ Parcial | Algumas funções fazem whitelist, outras não |
| Rate Limiting | ✅ Implementado | `_shared/rate-limit.ts` (60 req/min) |
| Helmet/Headers | ✅ Implementado | `_shared/security-headers.ts` |
| CORS restritivo | ✅ Implementado | `_shared/cors.ts` com allowlist |
| Upload seguro | ✅ Implementado | `file-security.ts` (magic bytes + whitelist) |
| MIME validation | ✅ Implementado | Validação 3 camadas |
| Limite tamanho | ✅ Implementado | 20MB max |
| Logs de login | ✅ Parcial | `audit_logs` + `access_audit_log` |
| Logs de erro | ⚠️ Básico | Console only, sem structured logging |
| HTTPS | ✅ Nativo | Supabase/Lovable forçam HTTPS |
| Env vars | ✅ Configurado | `.env` automático + secrets |
| SSRF Guard | ✅ Implementado | `ssrf-guard.ts` (HTTPS-only) |
| Token expiration | ✅ Nativo | Supabase Auth gerencia TTL |
| IP Blacklist | ❌ Não existe | Pode ser implementado |
| DDoS básico | ⚠️ Parcial | Rate limit existe, throttling não |

## Gaps Reais a Corrigir

Dos requisitos listados, existem **5 gaps** que podem ser fechados:

### 1. Structured Audit Logging (Edge Functions)
- Criar `_shared/structured-logger.ts` com níveis (info, warn, error, security)
- Registrar em tabela `security_audit_log` com campos: action, ip, user_agent, user_id, severity, metadata
- Integrar em todas as Edge Functions via wrapper

### 2. IP Blacklist Middleware
- Criar tabela `ip_blacklist` (ip, reason, expires_at, created_by)
- Criar middleware `_shared/ip-guard.ts` que verifica antes de processar
- Auto-blacklist após X falhas de login (via trigger)

### 3. Mass Assignment Protection
- Auditar Edge Functions que aceitam body direto sem whitelist
- Garantir que todas usem schema Zod (já existe `validateBody`)
- Funções como `create-admin-users` precisam de schema explícito

### 4. Request Throttling (complementar ao rate limit)
- Adicionar throttling progressivo: delay crescente após falhas consecutivas
- Implementar via RPC no banco (já existe infraestrutura de rate limit)

### 5. Login Security Enhancement
- Registrar todas tentativas de login (sucesso/falha) em `security_audit_log`
- Implementar account lockout após 5 falhas (já referenciado na memória)
- Notificar admin sobre padrões suspeitos

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| Migration SQL | Tabelas `security_audit_log` + `ip_blacklist` |
| `_shared/structured-logger.ts` | Criar — logging estruturado |
| `_shared/ip-guard.ts` | Criar — middleware IP blacklist |
| `_shared/request-throttle.ts` | Criar — throttling progressivo |
| `create-admin-users/index.ts` | Adicionar schema Zod + logging |
| `update-user-password/index.ts` | Adicionar logging de segurança |

## O que NÃO se aplica

- **Servidor Node.js** (Express/Fastify): impossível no Lovable
- **Prisma/Sequelize ORM**: Supabase SDK já protege contra injection
- **CSRF tokens**: desnecessário com auth JWT (sem cookies)
- **Armazenamento fora da raiz**: storage é gerenciado pelo Supabase

## Resumo

Score atual: **~85/100**. Com as 5 correções acima: **~95/100**. A arquitetura existente já cobre a maioria dos vetores OWASP Top 10. Os gaps são em logging estruturado, IP blacklist e throttling.

