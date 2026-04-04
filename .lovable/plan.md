

# Implementar Pentest Automatizado e WAF L7 no Edge Functions

## Contexto

Os dois últimos itens do checklist de produção em `docs/SECURITY.md` são de infraestrutura externa. Como o sistema roda em Lovable Cloud (sem acesso a Cloudflare ou ferramentas externas), a abordagem é implementar **equivalentes em código**:

1. **Pentest automatizado** — Edge Function que executa testes de segurança contra o próprio sistema (SQL injection, auth bypass, XSS probes, RLS validation) e gera relatório
2. **WAF L7 em código** — Middleware de proteção na camada de aplicação com detecção de payloads maliciosos, bot filtering e request fingerprinting

## O Que Já Existe

- `_shared/security-middleware.ts` — IP blocklist com cache
- `_shared/rate-limit.ts` — Rate limiting por IP/user com blocklist check
- `_shared/security-headers.ts` — Headers de segurança (CSP, X-Frame-Options, etc.)
- `_shared/cors.ts` — CORS lockdown por origem (sem `*`)
- Tabelas: `security_ip_blocklist`, `security_audit_log`, `api_rate_limit`

## Plano

### 1. WAF L7 — `_shared/waf.ts` (novo)

Middleware de Web Application Firewall que inspeciona **cada request** antes do processamento:

- **Payload inspection**: Detecta padrões de SQL injection (`UNION SELECT`, `OR 1=1`, `DROP TABLE`), XSS (`<script>`, `onerror=`), path traversal (`../`, `%2e%2e`)
- **Bot detection**: Verifica User-Agent contra lista de bots maliciosos conhecidos, rejeita requests sem User-Agent
- **Request size limiting**: Bloqueia payloads acima de 1MB (configurável)
- **Geo/header anomaly**: Flag requests com headers suspeitos (muitos headers, encoding incomum)
- **Logging**: Registra tentativas bloqueadas em `security_audit_log` com classificação do ataque

Resultado: `{ allowed: true }` ou `{ allowed: false, reason: "sql_injection_detected" }`

### 2. Integrar WAF nas Edge Functions críticas

Adicionar `wafCheck(req)` no início das 5-10 Edge Functions mais expostas (as que já usam `checkRateLimit`):
- `integration-router`
- `boletos-api`
- `projetos-api`
- `erp-fornecedores-sync`
- `tipos-entrega-api`
- `tipos-documento-api`

### 3. Pentest Automatizado — `security-pentest/index.ts` (nova Edge Function)

Edge Function protegida por API key que executa bateria de testes:

- **Auth bypass**: Tenta acessar endpoints sem token, com token expirado, com token de outro user
- **SQL injection probes**: Envia payloads maliciosos para endpoints e verifica se são rejeitados (pelo WAF)
- **RLS validation**: Tenta ler dados de outro usuário via queries diretas
- **XSS probes**: Envia payloads XSS e verifica se são sanitizados
- **Rate limit validation**: Envia rajada de requests e verifica se o throttling funciona
- **CORS validation**: Envia requests com origens não autorizadas

Resultado: JSON com relatório `{ passed: 12, failed: 0, warnings: 1, details: [...] }`

### 4. Tabela de relatórios — `security_pentest_reports` (migração)

```sql
CREATE TABLE security_pentest_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at TIMESTAMPTZ DEFAULT now(),
  executed_by UUID REFERENCES auth.users(id),
  total_tests INT,
  passed INT,
  failed INT,
  warnings INT,
  details JSONB,
  score NUMERIC(4,1)
);
```

Com RLS restrito a admin.

### 5. Atualizar documentação

Marcar ambos itens como ✅ em `docs/SECURITY.md` e atualizar `SEGURANCA_PRODUCAO.md` com descrição das implementações.

## Arquivos

| Arquivo | Tipo |
|---|---|
| `supabase/functions/_shared/waf.ts` | Novo — WAF L7 middleware |
| `supabase/functions/security-pentest/index.ts` | Nova Edge Function |
| 6 Edge Functions existentes | Adicionar `wafCheck()` |
| 1 migração SQL | Tabela `security_pentest_reports` + RLS |
| `docs/SECURITY.md` | Atualizar checklist |
| `SEGURANCA_PRODUCAO.md` | Atualizar checklist |

