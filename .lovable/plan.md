# Hardening de segurança — fechamento dos 7 findings residuais (N1–N8)

Plano em 6 fases sequenciais com **STOP checkpoint** entre cada uma. Phase 2 (Step-up + Audit log) já foi parcialmente entregue nas iterações anteriores — verificarei o estado real antes de prosseguir.

## Estado atual já entregue (verificar)

- **Fase 2 parcial**: 5 funções de senha/admin já têm `requireMfa + requireStepUp` ativos no backend, frontend de `GerenciamentoUsuarios.tsx` já usa `useStepUp`. Falta: `security-admin`, `cofre-share`, `export-all-data` ativarem enforcement + frontends de `CofreSharePage.tsx` e `SecurityHardeningCenter.tsx`.
- **SSRF guard** (`_shared/ssrf-guard.ts`) já existe; cobertura atual ~6 funções.
- **Audit log helper** (`_shared/audit-log.ts`) já existe e está em uso nas 8 funções alvo.

## Ordem de execução

```text
Fase 1 — SSRF guard (12 funções)              [Dia 1-2]   STOP
Fase 2 — Finalizar Step-up + Audit (3 fns)    [Dia 3-4]   STOP por lote
Fase 3 — Storage signed URLs + auditoria      [Dia 5-6]   STOP
Fase 4 — mfaFailMode: "closed" (12 fns)       [Dia 7]     STOP
Fase 5 — Zod input validation (Lote A/B/C)    [Dia 8+]    STOP por lote
Fase 6 — Quarentena TTL 30s → 5s              [Dia 8]     trivial
```

---

## Fase 1 — SSRF guard

**Funções alvo (12)** — adicionar `validateExternalUrl()` antes de cada `fetch()` com URL dinâmica:

🔴 ALTA: `webhook-dispatcher`, `phyllo-proxy`, `pluggy-proxy`, `stitch-proxy`
🟡 MÉDIA: `meeting-transcribe`, `realtime-call-session`, `sofia-voice-token`, `whatsapp-business-api`, `instagram-insights`, `resolve-post-media`, `ingest-influencer-media`

URLs hardcoded (apify-*, pollo-*, elevenlabs-*, geocode-*, fal-*, google-places-*) **não** recebem guard.

**Padrão:**
```ts
import { validateExternalUrl, SSRFError } from "../_shared/ssrf-guard.ts";
try { validateExternalUrl(targetUrl); }
catch (e) {
  if (e instanceof SSRFError) return errorResponse(400, "SSRF-001", e.message, req, startMs);
  throw e;
}
```

**Aceite:**
- 12 funções com guard
- Smoke: `http://169.254.169.254/...` em `webhook-dispatcher` → 400
- Smoke: URL legítima → 200
- `docs/SECURITY-SSRF-COVERAGE.md` criado

---

## Fase 2 — Finalizar Step-up MFA + Audit log

**Já feito:** `admin-reset-password`, `admin-bulk-set-password`, `update-user-password`, `delete-admin-user`, `create-admin-users` (backend ativo + frontend em `GerenciamentoUsuarios`).

**Falta fazer:**

1. **`security-admin`** — ativar `requireStepUp: "security.admin.config"` + wirar token em `SecurityHardeningCenter.tsx`
2. **`cofre-share`** — wirar `useStepUp("cofre.share")` em `CofreSharePage.tsx` (backend já tem audit log; ativar enforcement)
3. **`export-all-data`** — confirmar se há call site no frontend; se sim, wirar; se for só n8n, deixar como audit-log-only (já está)

**Infra:**
- Verificar se `security_audit_log.metadata` tem índice GIN; se não, criar via migration
- Atualizar `docs/SECURITY-STEPUP-AUDITLOG.md` com status final

**Aceite:**
- 3 cenários × 3 funções = 9 smoke tests (sem token / inválido / válido)
- Audit log gravando outcome em todas

---

## Fase 3 — Storage signed URLs

**Discovery (read-only, antes de qualquer mudança):**

```sql
SELECT id, name, public, file_size_limit FROM storage.buckets ORDER BY public DESC;
SELECT polname, cmd, qual::text FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
  WHERE c.relname='objects' AND c.relnamespace='storage'::regnamespace;
SELECT bucket_id, count(*), pg_size_pretty(sum((metadata->>'size')::bigint)) FROM storage.objects GROUP BY 1;
```

**Triagem por bucket:** público intencional (logos/branding) | privado por tenant | privado por usuário | sensível (PII/financeiro, TTL ≤5min + audit).

**Ações:**
- `public=false` em buckets sensíveis (com confirmação do usuário)
- RLS em `storage.objects` por `empresa_id`/`owner`
- Frontend: `createSignedUrl(path, ttl)` em vez de URL pública

**Aceite:**
- `docs/SECURITY-STORAGE-AUDIT.md` com tabela de classificação
- Smoke cross-tenant: usuário empresa A não baixa arquivo de B
- 0 ERROR no linter

**STOP forte:** confirmar lista de buckets que vão de `public=true → false` antes de aplicar.

---

## Fase 4 — MFA fail-closed para operações críticas

**Mudança em `_shared/secure-handler.ts`:**

```ts
export interface SecureHandlerConfig {
  // ...
  mfaFailMode?: "open" | "closed"; // default "open"
}

// no catch da RPC mfa_is_enforced_for_user:
if (config.mfaFailMode === "closed") {
  return new Response(
    JSON.stringify({ error: "MFA verification unavailable", code: "MFA_CHECK_FAILED" }),
    { status: 503, headers: withSecurityHeaders({...corsHeaders, "Content-Type": "application/json"}, true) }
  );
}
```

**Aplicar `mfaFailMode: "closed"` em (12):** as 8 da Fase 2 + `contas-pagar-api` (DELETE), `contas-receber-api` (DELETE), `lancamentos-cc-api` (DELETE), `movimentos-financeiros-api` (DELETE).

**Aceite:** simulação de falha na RPC → função `closed` retorna 503; `open` (default) retorna 200.

**Dependência:** Fase 2 100% em produção primeiro.

---

## Fase 5 — Zod input validation (~120 funções)

**Padrão:** `z.object({...}).strict()` + `safeParse(await req.json())` + `errorResponse(400, "VAL-001", ...)`.

**Lotes:**

- **Lote A — Financeiro (~25):** `contas-*-api`, `boletos-api`, `lancamentos-cc-api`, `movimentos-financeiros-api`, `processar-transacao-n8n`, `conciliacao-bancaria`, `erp-export-payment`, `erp-fornecedores-sync`, `erp-sync-engine`. **Prioridade.**
- **Lote B — Admin/segurança (~15):** `admin-*`, `security-*`, `mfa-*`, `update-user-password`, `delete-admin-user`, `create-admin-users`.
- **Lote C — Operacional (~80):** backlog em PRs separados.

**Aceite por lote:** payload com campo extra → 400; payload válido → 200. `docs/SECURITY-INPUT-VALIDATION.md` com padrão.

---

## Fase 6 — Quarentena TTL 30s → 5s

Trivial: `_shared/secure-handler.ts` linha do `quarantineCache.set` muda `30_000` → `5_000`. Smoke: usuário marcado como quarantined → 423 em 5s.

---

## STOP CONDITIONS globais

Pare e reporte se:
- Build do Supabase quebrar
- E2E `scripts/security/e2e-authenticated-sensitive-columns.sh` regredir
- Linter ganhar **qualquer ERROR** novo
- Função das 217 já em `secureHandler` deixar de retornar 200
- Frontend quebrar para usuário não-admin

## Regras invioláveis

- Nunca pular soak entre Fase 2 lotes
- Nunca aplicar Fase 4 antes da Fase 2 estar 100% em prod
- Nunca mudar bucket `public=true → false` sem confirmação do usuário
- Nunca `ALTER TABLE` em `security_audit_log`/`api_security_log` — usar JSONB `metadata`
- Nunca exigir step-up em endpoint sem frontend pronto

## Reporte por fase

1. Findings fechados (delta)
2. Smoke tests rodados (cenários + resultado)
3. Linter (ERRORs = 0; delta de warnings)
4. Docs criados/atualizados
5. Riscos detectados

## Início proposto

Quando aprovar, começo pela **Fase 1 (SSRF)** — risco mais baixo, não muda contrato HTTP, fecha o vetor mais crítico (AWS metadata exfiltration). Encerro com o checkpoint e aguardo seu OK para Fase 2.
