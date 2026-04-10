

# Reforço Total de Segurança — Blindagem Contra Ataques

## Vulnerabilidades Críticas Detectadas

### ERRO 1 — `empresas` expõe todos os dados a qualquer usuário autenticado
A policy `empresas_select_policy` tem `USING(true)`, permitindo que qualquer usuário autenticado leia CPF, CNPJ, email e telefone de **todas** as empresas. A policy scoped correta existe mas é ignorada porque policies permissivas são combinadas com OR.

### ERRO 2 — `security_audit_log` no Realtime publica eventos para todos
A tabela está na publicação `supabase_realtime`, transmitindo IPs, ações e metadados de segurança para qualquer subscriber autenticado.

### ERRO 3 — 3 tabelas com SELECT `USING(true)` sem restrição
- `china_ficha_visibilidade`
- `fluxo_aprovacao_aprovadores`  
- `produto_brasil_pasta_digital`

### ERRO 4 — Edge Functions `fal-video-generate` e `fal-video-status` sem WAF/Rate Limiting/Security Headers
As duas novas funções de vídeo não usam o `secureHandler` nem middleware de segurança. Podem ser abusadas para queimar créditos fal.ai.

### AVISO 5 — ~12 tabelas de produto com policies `auth.uid() IS NOT NULL` sem ownership
Tabelas como `produto_brasil_checklist`, `produto_brasil_grade_itens`, `produto_fluxo_artes`, etc., permitem qualquer autenticado ler/escrever.

## Correções Planejadas

### A. Migration SQL — RLS Hardening (6 correções)

1. **DROP `empresas_select_policy`** (a `USING(true)`). A policy scoped `empresas_scoped_select` já cobre o acesso correto.

2. **REMOVE `security_audit_log` do Realtime**:
```sql
ALTER PUBLICATION supabase_realtime DROP TABLE public.security_audit_log;
```

3. **Restringir 3 tabelas com `USING(true)`**:
   - `china_ficha_visibilidade`: trocar para `has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor') OR auth.uid() IS NOT NULL AND EXISTS(select from user_empresa_access...)`
   - `fluxo_aprovacao_aprovadores`: restringir a participantes do fluxo ou admin/supervisor
   - `produto_brasil_pasta_digital`: restringir a owner do produto ou admin/supervisor

4. **Hardening das ~12 tabelas de produto**: Substituir `auth.uid() IS NOT NULL` por verificação de papel (admin/supervisor/fábrica) em INSERT/UPDATE/DELETE

### B. Edge Functions — Blindar `fal-video-generate` e `fal-video-status`

Adicionar a ambas as funções:
- **WAF L7** (import do `_shared/waf.ts`)
- **Security Headers** (import do `_shared/security-headers.ts`)
- **Rate Limiting** (import do `_shared/rate-limit.ts` — limite 10/min para geração, 60/min para status)
- **Security Middleware** (import do `_shared/security-middleware.ts` — checagem de IP blocklist)
- **Autenticação obrigatória** — rejeitar se `userId` for null (atualmente permite sem autenticação)

### C. Logging de ataque — Registrar tentativas bloqueadas

Adicionar log no `security_audit_log` quando:
- Rate limit excedido nas funções de vídeo
- Requisição sem autenticação tentada
- IP bloqueado tentar acessar

## Arquivos a alterar

| Arquivo | Ação |
|---------|------|
| Migration SQL | DROP policy empresas, remove realtime, harden 15+ tabelas |
| `supabase/functions/fal-video-generate/index.ts` | WAF + rate limit + security headers + auth obrigatória |
| `supabase/functions/fal-video-status/index.ts` | WAF + rate limit + security headers + auth obrigatória |

## Resultado esperado

- Zero tabelas com `SELECT USING(true)` permissivo
- Zero dados sensíveis no Realtime
- 100% das Edge Functions com WAF + rate limiting + auth
- Proteção contra abuso de créditos fal.ai
- Score de segurança mantido em 100/100

