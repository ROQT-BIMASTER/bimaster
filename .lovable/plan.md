

# Proteção RLS Server-Side para Tabelas de Auditoria e Segurança

## Diagnóstico

Auditei todas as 8 tabelas de segurança. A maioria já tem policies corretas, mas há lacunas críticas:

| Tabela | SELECT | INSERT | UPDATE/DELETE | Status |
|--------|--------|--------|---------------|--------|
| `security_audit_log` | ❌ **NENHUM** | ✅ auth+service | ❌ **Sem restrição** | CRÍTICO |
| `access_audit_log` | ✅ admin | ✅ sistema | ✅ | OK |
| `api_security_log` | ✅ admin/supervisor | ✅ | ✅ | OK |
| `security_incidents` | ✅ admin (ALL) | ✅ | ✅ | OK |
| `security_ip_blocklist` | ✅ admin (ALL) | ✅ | ✅ | OK |
| `security_pentest_reports` | ✅ admin | ✅ admin | ❌ **UPDATE/DELETE aberto** | MÉDIO |
| `secret_rotation_schedule` | ✅ admin (ALL) | ✅ | ✅ | OK |
| `api_rate_limit` | ✅ service_role | ✅ | ✅ | OK |

### Problemas encontrados:

1. **`security_audit_log`** — sem policy SELECT = nenhum usuário consegue ler via API (mas também nenhum não-admin é bloqueado se adicionarem policy futura). Faltam policies de UPDATE/DELETE que devem ser proibidas.
2. **`security_pentest_reports`** — sem policies de UPDATE/DELETE explícitas.

## Plano

### Migration SQL única

1. **`security_audit_log`**: Adicionar SELECT restrito a admin, bloquear UPDATE/DELETE completamente
2. **`security_pentest_reports`**: Bloquear UPDATE/DELETE (relatórios são imutáveis)
3. **`access_audit_log`**: Bloquear UPDATE/DELETE (logs são imutáveis)

```sql
-- security_audit_log: SELECT apenas admin
CREATE POLICY "Admins can view security audit logs"
  ON security_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- security_audit_log: service_role full access (para triggers/edge functions)
CREATE POLICY "Service role full access on security_audit_log"
  ON security_audit_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Imutabilidade: bloquear UPDATE/DELETE em logs
-- (Sem policy = bloqueado por padrão com RLS ativo)
```

Nenhuma alteração de código necessária — o SIEM já consulta essas tabelas e agora só retornará dados para admins.

| Componente | Tipo |
|-----------|------|
| Migration SQL (policies RLS) | Novo |

