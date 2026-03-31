

# Aprofundar Segurança — 9 Findings (5 Errors + 4 Warnings)

## Scan Atual

### 🔴 5 Errors

| # | Finding | Problema |
|---|---------|----------|
| 1 | **social_media_credentials_safe** | View expõe `access_token` e `refresh_token` sem `security_invoker = true` — qualquer autenticado lê OAuth tokens de outros |
| 2 | **team_member_details_safe** | View expõe CPF, RG, data de nascimento sem herdar RLS da tabela base |
| 3 | **stores_safe** | View expõe PIX, agência, conta bancária sem `security_invoker = true` |
| 4 | **fabrica_fornecedores_safe** | View expõe dados bancários de fornecedores sem proteção RLS |
| 5 | **erp_config** | API keys em plaintext acessíveis a admins sem criptografia |

### 🟡 4 Warnings

| # | Finding | Problema |
|---|---------|----------|
| 6 | **Extensions in public** | Limitação da plataforma (aceito) |
| 7 | **RLS always true** | Policies com `USING(true)` em operações de escrita |
| 8 | **configuracoes_cobranca** | `api_key` e `whatsapp_verify_token` em plaintext |
| 9 | **dynamic_form_responses** | Anon pode submeter PII sem rate limiting no RLS |

## Plano de Correção

### Fase 1 — Views com security_invoker (1 migration)

Recriar 4 views com `WITH (security_invoker = true)` e remover colunas sensíveis:

- **social_media_credentials_safe**: Remover `access_token` e `refresh_token`, substituir por `has_access_token boolean`
- **team_member_details_safe**: Mascarar CPF (`'***.XXX.XX-**'`) e RG, remover `email_pessoal` para non-admin
- **stores_safe**: Mascarar PIX e dados bancários para non-admin
- **fabrica_fornecedores_safe**: Mascarar dados bancários para non-admin

Todas com `security_invoker = true` para herdar RLS das tabelas base.

### Fase 2 — Credentials Hardening (1 migration)

- **erp_config**: Criar policy que oculta `api_key` e `api_key_anterior` no SELECT — retornar apenas `api_key_hash` e flag `has_key`. Verificar se edge functions usam plaintext (já verificado: `_shared/auth.ts` usa hash comparison, pode remover plaintext)
- **configuracoes_cobranca**: Mesma abordagem — ocultar `api_key` e `whatsapp_verify_token` via view safe existente

### Fase 3 — Dynamic Forms Rate Limiting (1 migration)

Adicionar constraint no RLS de `dynamic_form_responses` para limitar submissions por IP/sessão:
```sql
-- Limitar a 10 respostas por form por sessão anon (via created_at interval)
CREATE POLICY "Rate limit anon submissions"
  ON dynamic_form_responses FOR INSERT TO anon
  WITH CHECK (
    EXISTS (SELECT 1 FROM dynamic_forms f WHERE f.id = form_id AND f.status = 'active')
    AND (SELECT count(*) FROM dynamic_form_responses r 
         WHERE r.form_id = dynamic_form_responses.form_id 
         AND r.created_at > now() - interval '1 hour'
         AND r.respondent_ip = current_setting('request.headers', true)::json->>'x-forwarded-for'
        ) < 10
  );
```

### Fase 4 — RLS always true audit

Identificar tabelas com `WITH CHECK(true)` em INSERT/UPDATE/DELETE e restringir onde possível.

### Fase 5 — Platform findings

Marcar `extensions_in_public` como limitação aceita.

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 5 errors, 4 warnings | 0 errors, 2 warnings (platform + aceitos) |
| Score ~92 | Score ~98 |

## Execução

3 migrations SQL. Verificação prévia do frontend para garantir que views recriadas não quebrem queries existentes. Zero alterações no frontend.

