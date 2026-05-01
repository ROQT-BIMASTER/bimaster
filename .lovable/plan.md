
# Plano: Hardening de Segurança Profundo — Bimaster

Objetivo: levar o sistema a um patamar competitivo com empresas grandes, focando perímetro/anti-ataque, com MFA obrigatório para admins e financeiro, audit imutável LGPD+SOC2-ready, com janela noturna para enforcement.

Base atual já presente (não vamos refazer): `secureHandler`, WAF L7, rate-limit Redis, security-headers, ddos-shield, security-ai-sentinel, security-correlation-engine, security-pentest, RLS difundido, ssrf-guard, idempotency, file-upload magic bytes, storage UID-scoped, secure handler em Edge Functions.

Diagnóstico rápido:
- 754 findings no scan: dominados por `SECURITY DEFINER` callable por anon, 1 view SECURITY DEFINER, 2 extensões em `public`, e múltiplos avisos de `search_path` mutável.
- Falta MFA enforcement, anti-bot adaptativo, geo/ASN policy, audit imutável WORM, step-up auth, e CSP/Trusted Types no frontend.

```text
Camadas a implementar
┌──────────────────────────────────────────────────────────────────┐
│ L0  Perímetro: WAF v2 adaptativo + Bot/ASN + Geo + DDoS shield   │
│ L1  Identidade: MFA TOTP + Step-up + Device fingerprint + HIBP   │
│ L2  Sessão: rotação refresh + revoga em mudança IP/UA + idle TO  │
│ L3  Acesso: RLS auditada + funções DEFINER trancadas + ABAC      │
│ L4  Dados: PII masking + audit WORM + criptografia campo sens.   │
│ L5  Aplicação: CSP strict + SRI + Trusted Types + clickjacking   │
│ L6  Observ.: SIEM interno + alertas + anomalia ML + runbooks     │
│ L7  Resposta: kill-switch, lockout, quarentena de conta          │
└──────────────────────────────────────────────────────────────────┘
```

## Fase 1 — Hardening do Banco (fechar 754 findings)

1. **Funções `SECURITY DEFINER` callable por `anon`**: revogar `EXECUTE FROM public, anon` em todas as funções sensíveis; manter apenas as que precisam (RLS helpers como `has_role`).
2. **`SECURITY DEFINER` View**: converter para `SECURITY INVOKER` ou substituir por RPC explícita.
3. **`search_path` mutável**: forçar `SET search_path = public, pg_temp` em todas as funções.
4. **Extensões em `public`**: mover `pg_trgm` e similares para schema `extensions`.
5. **Rotina contínua**: cron (`pg_cron`) que falha CI se aparecerem novas funções sem `search_path` ou com EXECUTE para `anon`.

## Fase 2 — Identidade e Sessão (MFA + Step-Up)

1. **MFA TOTP obrigatório** para roles: `admin`, `financeiro`, `diretoria`. Enforcement em login + na primeira ação sensível (step-up se sessão tiver >15min sem MFA).
2. **Página `/auth/mfa/setup`** + recovery codes (10 códigos one-time, hash bcrypt).
3. **Tabela `user_mfa_factors`** com `verified_at`, `last_used_at`, RLS própria.
4. **HIBP password check** (`password_hibp_enabled: true`).
5. **Lockout progressivo**: 5 falhas/15min → captcha; 10/h → bloqueio 1h; 20/dia → bloqueio + alerta admin.
6. **Device fingerprint** (FingerprintJS open-source ou `client-hints`) → `user_devices`. Notificação por e-mail em novo device.
7. **Session hardening**: rotação de refresh token a cada uso, revogação automática se IP/ASN mudar drasticamente, idle timeout 30min para roles sensíveis.
8. **Sudo mode**: ações críticas (export, alterar permissões, redefinir senha de outros) exigem reconfirmação de senha+MFA nos últimos 5min.

## Fase 3 — Perímetro Adaptativo

1. **WAF v2** (`_shared/waf.ts`): regras adicionais — SSRF semântico (host allowlist obrigatório por função), prototype pollution, NoSQL injection patterns, HTTP smuggling, JWT-none.
2. **Bot scoring**: heurística por `user-agent`, ausência de `sec-ch-ua`, ASN de datacenter (lista AWS/GCP/Azure/OVH), velocidade de cliques. Score ≥ threshold → challenge.
3. **Geo & ASN policy**: por padrão permitir BR, CN (operação China), US. Outros → step-up MFA. Configurável em `security_geo_policy`.
4. **Rate-limit adaptativo**: limite cai automaticamente para IP/ASN com falhas 4xx/5xx recentes (token bucket dinâmico).
5. **Anti-enumeration**: respostas de login/recuperação com timing constante (já existe `timing-safe.ts`, expandir cobertura) e mensagens uniformes.
6. **Edge global headers**: `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`, `Cross-Origin-Resource-Policy: same-site`.

## Fase 4 — Frontend Hardening

1. **CSP strict** com nonces (sem `unsafe-inline`), `script-src 'self' 'nonce-…'`, `frame-ancestors 'none'`.
2. **Trusted Types** via meta-policy para neutralizar XSS DOM.
3. **SRI** em todos scripts/CSS externos.
4. **Anti-clickjacking**: `X-Frame-Options DENY` + `frame-ancestors 'none'`.
5. **Service Worker** com cache assinado para evitar cache poisoning de assets críticos.
6. **Sanitização**: revisar todos `dangerouslySetInnerHTML`, embrulhar com DOMPurify.
7. **Logout em todas as abas** via BroadcastChannel ao detectar revogação de sessão.

## Fase 5 — Audit Imutável + LGPD/SOC2

1. **`audit_log_immutable`**: tabela append-only, sem UPDATE/DELETE policies, com hash em cadeia (cada linha tem `prev_hash`/`row_hash` SHA-256) — verificável por job diário.
2. **Triggers** em todas as tabelas sensíveis (`profiles`, `user_roles`, `contas_pagar`, `contas_receber`, `cofre_*`, `produtos_custos`, `processos_aprovados`) registrando `actor`, `op`, `before`, `after`, `ip`, `ua`, `request_id`.
3. **Retenção**: 5 anos para financeiro, 2 anos para acesso, conforme matriz LGPD.
4. **DSR (Direito do Titular)**: endpoints `data-export-self` e `data-erase-self` (com soft-delete + anonimização para registros financeiros que não podem ser apagados por lei).
5. **PII masking** automático em logs (CPF, CNPJ, e-mail, telefone) via middleware nas Edge Functions.
6. **Field-level encryption** (pgsodium/pgcrypto) para colunas: `cofre_*.valor`, `usuarios.cpf`, dados bancários. Chaves via `vault`.
7. **Consent log**: tabela `lgpd_consents` versionada por finalidade.
8. **Política de senhas**: 12+ chars, HIBP, expiração 180d para admin/financeiro.

## Fase 6 — Observabilidade & Resposta (SIEM interno)

1. **Tabela `security_events`** consolidada (auth_fail, mfa_fail, waf_block, rate_limit_hit, anomaly).
2. **Engine de correlação** (já existe `security-correlation-engine`): ampliar com regras — credential stuffing, impossible travel, privilege escalation, mass-export.
3. **Alertas** para Slack/e-mail em P1; **kill-switch** por usuário/empresa (flag `account_quarantined`).
4. **Dashboard /admin/security**: KPIs ao vivo, top atacantes, mapa de ameaças, status de cada camada.
5. **Runbooks** documentados em `docs/security/runbooks/` (account takeover, data exfil, ransomware risk).
6. **Pentest contínuo**: `security-pentest` em cron diário cobrindo OWASP API Top 10.

## Fase 7 — Supply Chain & Operação

1. **Dependabot/audit** semanal + bloqueio de merge com vuln HIGH+.
2. **Lockfile assinado**, `bun audit` em CI.
3. **Build secrets**: rotação documentada de `LOVABLE_API_KEY`, `RESEND`, `PHYLLO`, `FAL`, `APIFY`.
4. **Backups**: snapshot diário + WAL contínuo + restore drill mensal.
5. **DR plan**: RPO 15min, RTO 1h; documentado.
6. **Code-review obrigatório** para qualquer migration/edge function via política branch.

## Detalhes técnicos

- **MFA**: usar `@simplewebauthn/server`-compatible TOTP via `otplib` em Edge Function `mfa-enroll` / `mfa-verify`. Tabela `user_mfa_factors(user_id, secret_encrypted, type, verified_at, last_used_at)`. Hook em `secureHandler` com flag `requireMFA: true` checa claim `amr=['mfa']` no JWT (Supabase MFA nativo).
- **Step-up**: claim `aal=aal2` exigida; falha → 401 com header `X-Required-AAL: aal2` para o front redirecionar a `/auth/mfa/challenge`.
- **Audit hash chain**: trigger `BEFORE INSERT` calcula `row_hash = sha256(prev_hash || jsonb_strip_nulls(NEW))`. Job `audit-verify` diário relê últimas 24h.
- **CSP nonce**: middleware Vite-side gera nonce por request servido em meta tag injetada no `index.html` por edge ou template.
- **WAF v2**: arquivos `_shared/waf-rules/*.ts` modulares, com versionamento e shadow-mode (loga sem bloquear) por 7 dias antes de enforcement.
- **Field encryption**: `pgsodium` extension em schema próprio; views `*_decrypted` apenas para owner/admin via SECURITY INVOKER.

## Cronograma sugerido (janelas noturnas)

```text
Noite 1: Fase 1 (DB findings) + ativar HIBP
Noite 2: Fase 2 (MFA + lockout) — feature flag, enforcement em D+2
Noite 3: Fase 3 (WAF v2 shadow + Geo/ASN)
Noite 4: Fase 4 (CSP strict + Trusted Types)
Noite 5: Fase 5 (Audit imutável + PII mask + field encryption)
Noite 6: Fase 6 (SIEM dashboard + alertas)
Noite 7: Fase 7 (CI security gates + drill restore)
```

## Entregáveis

- Migrations SQL para fechar 754 findings, audit imutável, MFA, criptografia e quarentena.
- Edge Functions: `mfa-enroll`, `mfa-verify`, `mfa-challenge`, `account-quarantine`, `data-export-self`, `data-erase-self`, `audit-verify`, `security-dashboard-kpis`.
- `_shared/waf-rules/*`, `_shared/mfa.ts`, `_shared/audit.ts`, `_shared/pii-mask.ts`.
- Páginas: `/auth/mfa/setup`, `/auth/mfa/challenge`, `/admin/security` (KPIs + ataques + ações).
- Hooks frontend: `useStepUpAuth`, `useDeviceFingerprint`, `useSudoMode`.
- `docs/security/`: política, runbooks, matriz LGPD, DR plan.
- Bump `APP_VERSION` + entrada no changelog `ApiDocumentation.tsx`.

## Riscos e mitigação

- **Quebrar logins ativos** ao impor MFA → rollout em 2 etapas (opt-in 48h + enforce). E-mail de aviso prévio.
- **CSP strict quebrar terceiros** (Phyllo, Apify SDKs) → modo report-only por 5 dias antes do enforce.
- **Geo policy bloquear viagens legítimas** → step-up MFA em vez de bloqueio absoluto.
- **Field encryption impactar performance** de relatórios → criar índices em `_hash` quando necessário e cache.
