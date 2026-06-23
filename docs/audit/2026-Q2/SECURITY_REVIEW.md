# SECURITY_REVIEW — Auditoria 2026-Q2

> Snapshot dos achados ativos dos scanners (Supabase linter, Lovable security
> scanner, agent_security) na coleta de junho/2026. Descritivo — **nenhuma
> correção** aplicada neste PR.

## 1. Achados ativos

| ID | Severidade | Scanner | Objeto | Resumo |
| --- | --- | --- | --- | --- |
| `pasta_digital_bucket_no_ownership_check` | 🔴 Crítico | supabase_lov | `storage.objects` (bucket `pasta-digital`) | SELECT autorizado a qualquer autenticado sem checar ownership do registro |
| `SUPA_security_definer_view` | 🔴 Crítico | supabase | view em `public` | Pelo menos 1 view `SECURITY DEFINER` |
| `dynamic_forms_anon_readable` | 🟠 Alto | supabase_lov | `dynamic_forms`, `dynamic_form_fields`, `dynamic_form_attachments` | SELECT a `anon` em rows `active` expõe `created_by` e contato |
| `SUPA_rls_policy_always_true` | 🟠 Alto | supabase | `public.*` | Pelo menos 1 policy `USING (true)` / `WITH CHECK (true)` em UPDATE/INSERT/DELETE |
| `bootstrap_no_mfa_stepup` | 🟠 Warn | agent_security | `create-admin-users-bootstrap` | Criação de admin sem MFA step-up |
| `cron_estoque_no_auth` | 🟠 Warn | agent_security | `cron-estoque-trigger` | `auth: "none"` sem `x-cron-secret`; sync multi-empresa público |
| `nfe_xml_no_ratelimit` | 🟠 Warn | agent_security | `process-nfe-xml` | `auth: "none"` + `rateLimit: 0` grava XML cru |
| `seed_demo_data_no_ratelimit` | 🟠 Warn | agent_security | `seed-demo-data` | `auth: "none"` + `rateLimit: 0` insere em 12 tabelas |

## 2. Priorização sugerida (entrada do roadmap em PR-5)

### P0 — bloquear na próxima janela
1. **`pasta-digital` ownership** — risco de exposição de documentos confidenciais entre tenants.
2. **`SUPA_security_definer_view`** — bypass de RLS via view; identificar e converter.
3. **`SUPA_rls_policy_always_true`** — escrita não restrita; identificar tabela(s) e corrigir.

### P1 — próxima sprint de segurança
4. **`bootstrap_no_mfa_stepup`** — deletar a função ou adicionar `requireStepUp: "user.create.admin"` + `requireMfa: true`.
5. **`cron_estoque_no_auth`** — validar `x-cron-secret` na entrada (padrão `china-sla-monitor`).
6. **`nfe_xml_no_ratelimit`** — `auth: "jwt"` + `rateLimit: 30` + cap de tamanho do `xml`.
7. **`seed_demo_data_no_ratelimit`** — `requireRole: "admin"` ou deletar.

### P2 — decisão de produto
8. **`dynamic_forms_anon_readable`** — restringir `anon` e expor via RPC pública mínima, OU mascarar colunas em view + policy.

## 3. Patterns de remediação (referência)

### 3.1 Storage com ownership real

```sql
DROP POLICY IF EXISTS "pasta_digital_select_any_auth" ON storage.objects;

CREATE POLICY "pasta_digital_select_owner_or_team"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pasta-digital' AND (
    EXISTS (SELECT 1 FROM public.produto_brasil_pasta_digital p
            WHERE p.storage_path = name
              AND (p.created_by = auth.uid()
                   OR public.has_role(auth.uid(), 'admin')
                   OR EXISTS (SELECT 1 FROM public.equipe_membros m
                              WHERE m.user_id = auth.uid()
                                AND m.empresa_id = p.empresa_id)))
    OR
    EXISTS (SELECT 1 FROM public.china_pasta_digital c
            WHERE c.storage_path = name
              AND <regra equivalente>)
  )
);
```

### 3.2 Cron secret no header

```ts
import { timingSafeEqual } from "../_shared/timing-safe.ts";

const provided = req.headers.get('x-cron-secret') ?? '';
const expected = Deno.env.get('CRON_SECRET') ?? '';
if (!provided || !timingSafeEqual(provided, expected)) {
  return new Response(JSON.stringify({ error: 'forbidden' }), {
    status: 403, headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
```

### 3.3 Bootstrap admin com step-up

```ts
Deno.serve(secureHandler({
  auth: "jwt",
  requireMfa: true,
  requireStepUp: "user.create.admin",
  mfaFailMode: "closed",
  rateLimit: 5,
  rateLimitPrefix: "create-admin-users-bootstrap",
}, async (req, ctx) => { /* ... */ }));
```

### 3.4 RPC pública mínima para forms

```sql
CREATE OR REPLACE FUNCTION public.get_public_form(_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', f.id, 'slug', f.slug, 'title', f.title,
    'fields', (SELECT jsonb_agg(jsonb_build_object(
                  'id', x.id, 'label', x.label, 'type', x.type, 'required', x.required, 'order', x.order_index))
               FROM public.dynamic_form_fields x WHERE x.form_id = f.id ORDER BY x.order_index)
  )
  FROM public.dynamic_forms f
  WHERE f.slug = _slug AND f.status = 'active';
$$;

REVOKE ALL ON FUNCTION public.get_public_form(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_form(text) TO anon, authenticated;
-- Em seguida: remover policy SELECT anon de dynamic_forms / fields / attachments.
```

## 4. Pontos fortes confirmados

- **RLS 100%** (858/858 tabelas).
- **Zero buckets públicos** (50/50 privados).
- **Pipeline `secureHandler` consolidado** (CORS → WAF → IP blocklist → JWT/API-key → quarentena → MFA → step-up → rate-limit).
- **`callAIGateway` único caminho IA no edge** — sem chamadas diretas ao gateway.
- **CI de segurança ativo**: `security-rls-e2e.yml`, `regression-greps.yml`, `dependency-review.yml` (PR-1), `codeql.yml` (PR-1).
- **PWA com kill switch** (`app_release_pins`) + telemetria de versão (`mem://pwa/anti-cache-versioning`).

## 5. Itens fora deste ciclo

- Aplicação das remediações P0/P1/P2 (PRs dedicados).
- Pentest formal (entrada para `security_pentest_reports`).
- Revisão LGPD / DPIA (já existe trilha em `mem://security/lgpd-pii-and-data-governance`).
