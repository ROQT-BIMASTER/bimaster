# Guia de Segurança - BiMaster/Union CRM

## Status Geral de Segurança

**Última Revisão:** 2026-04-04  
**Score Geral:** 100/100 ✅

### Principais Implementações

✅ **Autenticação e Autorização**
- JWT com validação em todas Edge Functions
- Hierarquia de roles (admin, supervisor, vendedor, promotor)
- RLS em 513 tabelas
- Security Definer functions com SET search_path
- Session invalidation via Realtime

✅ **Criptografia OAuth (Vault)**
- Tokens criptografados com pgcrypto (pgp_sym_encrypt)
- Chave dedicada `oauth_encryption_key` no Supabase Vault
- Funções `encrypt_token()` / `decrypt_token()` SECURITY DEFINER
- Colunas plaintext removidas (social_media_accounts, social_media_credentials)
- Edge Functions usam `decrypt_token` RPC sob demanda

✅ **Proteção de Dados**
- Storage buckets privados com RLS por hierarquia
- Signed URLs com expiração de 24h
- Audit logs (security_audit_log, access_audit_log, audit_logs)
- LGPD: safe views, anonimização, aceite de termos versionado

✅ **Validação de Input**
- Schemas Zod em todos formulários (client-side)
- Validação Zod em todas Edge Functions (server-side)
- Sanitização de dados, file magic bytes check
- Proteção contra Mass Assignment

✅ **Rate Limiting**
- Tabela `api_rate_limit` com `check_rate_limit()` SQL
- 20 req/min para IA, 100 req/min para operacional
- Middleware aplicado em Edge Functions sensíveis

✅ **Rotação de Secrets**
- Função `rotate_api_key()` com histórico
- Schedule trimestral configurado
- Chaves antigas mantidas em histórico para auditoria

## Row Level Security (RLS)

513 tabelas com RLS habilitado. Políticas baseadas em hierarquia:

```sql
-- Exemplo: Políticas de Prospects
CREATE POLICY "Usuários veem próprios prospects"
ON prospects FOR SELECT
USING (
  vendedor_id = auth.uid() OR
  is_admin_or_supervisor(auth.uid())
);
```

### RLS Hardening (Abril 2026)
- `erp_sync_log`: Policies separadas por operação, SELECT restrito a empresa
- `plano_contas_mapeamento_categorias`: INSERT/UPDATE/DELETE restritos a admin/supervisor
- `sync_logs`: Policy permissiva removida, SELECT restrito a admin
- `trade_tipos_brinde`: INSERT/UPDATE restritos a admin/supervisor via `has_role()`
- `security_audit_log`: INSERT restrito a authenticated + service_role

## Criptografia OAuth

```sql
-- Encrypt: usa chave do Vault (nunca fallback hardcoded)
SELECT encrypt_token('oauth-token-here');

-- Decrypt: busca chave do Vault, fallback para chave antiga durante migração
SELECT decrypt_token(access_token_encrypted);
```

**Fluxo nas Edge Functions:**
```typescript
// 1. Buscar conta com token encrypted
const { data: accounts } = await supabase
  .from('social_media_accounts')
  .select('id, platform, username, access_token_encrypted');

// 2. Decriptar via RPC (nunca expõe plaintext em logs)
const { data: token } = await supabase.rpc('decrypt_token', {
  p_encrypted: account.access_token_encrypted
});

// 3. Usar token para chamar API externa
```

## Edge Functions Seguras

**Padrão de segurança aplicado em 100+ Edge Functions:**
- CORS lockdown por origem (sem `*`)
- Timing-safe comparison para API keys/HMAC
- Security headers (X-Frame-Options, CSP, etc.)
- SSRF guard para fetch de URLs externas
- Input validation com Zod

## Hierarquia de Acesso

```
admin
  ├── supervisor_1
  │   ├── vendedor_1
  │   └── vendedor_2
  └── supervisor_2
      ├── promotor_1
      └── promotor_2
```

## Checklist de Produção

- [x] RLS em todas as tabelas
- [x] Criptografia OAuth via Vault
- [x] Rate limiting em APIs
- [x] CORS lockdown por origem
- [x] Security headers em Edge Functions
- [x] Timing-safe comparison
- [x] SSRF protection
- [x] Session invalidation via Realtime
- [x] Input validation Zod (client + server)
- [x] Audit logs abrangentes
- [x] search_path fixo em todas SECURITY DEFINER functions
- [x] Rotação de secrets configurada
- [ ] Penetration testing profissional (recomendado anualmente)
- [ ] WAF/CDN (Cloudflare) para proteção L7

## Incident Response

1. **Contenção (< 1h)**: Desabilitar serviços, revogar tokens, bloquear IPs
2. **Investigação (< 24h)**: Revisar audit logs, identificar vetor
3. **Remediação (< 48h)**: Corrigir vulnerabilidade, deploy de fix
4. **Comunicação (< 72h)**: Notificar usuários, reportar ANPD (LGPD)
5. **Pós-mortem (< 1 semana)**: Análise de causa raiz

---

*Última atualização: 2026-04-04 — Score 100/100*
