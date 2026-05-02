---
title: Segurança & LGPD
audience: ai-coding-agent
last_updated: 2026-05-02
---

# 07 — Segurança & LGPD

## Postura

- **Zero exposição pública** de tabelas. Cada policy começa restritiva.
- **Defesa em profundidade**: WAF + IP blocklist + JWT + RLS + auditoria + MFA + step-up.
- **PII** (CPF, CNPJ, email pessoal, telefone, endereço) protegido por mascaramento
  no SELECT e/ou função SECURITY DEFINER controlada.
- **LGPD**: consentimento explícito em UI; logs de acesso a PII; direito ao
  esquecimento via fluxo administrativo.

## Roles & autorização

- Tabela `user_roles` + função `has_role(_user_id, _role)` SECURITY DEFINER.
- **Nunca** roles em `profiles` / `users`.
- **Nunca** checar admin no client (`localStorage`, hardcoded, `if email == "..."`).
- Frontend pode mostrar/ocultar UI baseado em hook (`useUserRole`), mas a
  decisão final é **sempre** server-side via RLS ou função SECURITY DEFINER.
- **Hierarquia**: `supervisor_id` (recursivo). `gerente_id` deprecado.

## Edge Functions

- Sempre `secureHandler({...}, handler)` — pipeline em [`05-EDGE-FUNCTIONS.md`](./05-EDGE-FUNCTIONS.md).
- Zod **`.strict()`** em todo input (anti mass-assignment).
- Nunca log de body com PII / secrets.
- Operações destrutivas em massa: exigir `requireStepUp: "<scope>"`.
- Telas AP de governança: admin-only enforce no handler.

## Storage

- Buckets privados (`public = false`).
- Path obrigatório `<uid>/<...>` — RLS valida prefixo.
- Validação **magic-bytes** (`src/lib/utils/file-security.ts`) — extensão é
  enganosa.
- **Limite 20 MB**.
- **Double-extension** bloqueada (`x.pdf.exe`, `y.png.html`).
- Download via `triggerBlobDownload` (Blob → ObjectURL → revoke). **Nunca**
  `window.open(signedUrl)`.
- Compartilhamento externo via `Cofre` com token assinado e expiração.

## File upload — checklist

- [ ] Validação de tipo por magic-bytes (não só extensão).
- [ ] Tamanho ≤ 20 MB.
- [ ] Sanitização do nome (`sanitize` em `src/lib/utils/sanitize.ts`).
- [ ] Path com UID do dono.
- [ ] Bucket privado.
- [ ] RLS de SELECT usando prefixo do path.

## API security hardening

- Headers de segurança injetados em **toda** resposta (CSP, HSTS, X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- **Clickjacking**: rotas sensíveis bloqueiam embedding (E2E em
  `scripts/security/e2e-clickjacking.sh`).
- **HSTS** com subdomain scan (`scripts/security/hsts-subdomain-scan.sh`).
- **SSRF**: fetches externos passam por `_shared/ssrf-guard.ts`.

## MFA & step-up

- Admins/gerentes têm grace period; após expirar, edge bloqueia com
  `403 MFA_REQUIRED`.
- Ações de altíssimo risco (export massivo, exclusão de dados, etc.) usam
  `requireStepUp: "<scope>"` com token TOTP recente em header `X-Step-Up-Token`.

## Quarentena de conta

- Função `is_account_quarantined(_user_id)` (cache 30s no edge).
- Se true, todas as Edge Functions retornam `423 Locked`.
- Útil para compromisso suspeito enquanto admin investiga.

## Impersonation

- Admin pode atuar como outro usuário; UI filtra por papel.
- Auditado em log dedicado.
- Regras: `mem://features/admin/impersonation-system-standard`.

## Audit log

- Acessos a PII e ações sensíveis logadas em tabelas dedicadas.
- Helpers: `src/lib/auditLog.ts`, `src/lib/auditProjectAccess.ts`,
  `src/lib/utils/sensitive-audit.ts`, `src/lib/utils/permission-audit.ts`.

## Suite E2E de RLS

`scripts/security/`:

- `e2e-anonymous-sensitive-columns.sh` — garante que anônimo não vê colunas
  sensíveis.
- `e2e-authenticated-sensitive-columns.sh` — garante isolamento entre
  usuários.
- `e2e-clickjacking.sh` — headers anti-frame.
- `hsts-subdomain-scan.sh` — HSTS em subdomínios.

CI: `.github/workflows/security-rls-e2e.yml`.

Memória: `mem://security/rls-e2e-security-suite`.

## Secrets

- **Nunca** hardcodar.
- **Nunca** logar (`console.log(secret)`).
- Gerencie via tool de secrets do Lovable.
- No agent Lovable: `compgen -e` lista nomes (sem valores). Use
  `test -n "$VAR"` para verificar existência.

## Comunicação com usuário

- **Mascarar infra** (Lovable / Supabase / Postgres) — diga "backend" /
  "Lovable Cloud".
- Mensagens de erro nunca expõem stack trace ou nome de tabela.
- Para finanças, ocultar métricas internas que não são públicas.

Memórias relacionadas:
- `mem://security/politica-exposicao-zero-publica`
- `mem://security/file-upload-security-policy`
- `mem://security/storage-path-ownership-policy`
- `mem://security/lgpd-pii-and-data-governance`
- `mem://security/edge-function-secure-handler-standard`
- `mem://security/api-security-hardening-standard`
- `mem://security/admin-only-ap-governance-screens`
- `mem://security/granular-process-permissions-matrix`
- `mem://security/sidebar-isolation-pattern-restricted-users`
- `mem://security/projects-access-and-visibility-policy-v2`
- `mem://security/rls-e2e-security-suite`
- `mem://architecture/storage-blob-download-protocol`
