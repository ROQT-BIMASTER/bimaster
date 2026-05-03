# Documentação de Segurança — Bi Master

Índice consolidado da postura, controles e auditorias de segurança do sistema.

## Visão geral

- [Postura geral](../SECURITY.md) — política de disclosure
- [Status atual de hardening](./HARDENING-COMPLETE.md) — campanha 2026 (Phases 1–6)
- [Auditoria histórica](../AUDITORIA_SEGURANCA.md) — caso exista referência cruzada

## Por camada

### Edge Functions

- [Pipeline `secureHandler`](./EDGE-FUNCTIONS-HARDENING.md)
- [CORS lockdown](./CORS-LOCKDOWN.md)
- [SSRF guard](./SSRF-COVERAGE.md)
- [Webhooks HMAC](./WEBHOOKS-HMAC.md)
- [Input validation Zod](./INPUT-VALIDATION.md)
- [Cobertura Zod `.strict()`](./ZOD-STRICT-COVERAGE.md)

### Database

- [RLS audit](./RLS-AUDIT.md)
- [Findings M-series](./FINDINGS-M-SERIES.md)

### Identity & Access

- [Step-up MFA + Audit log](./STEPUP-AUDITLOG.md)
- [MFA fail-closed](./FAIL-CLOSED-MFA.md)

### Storage

- [Storage audit](./STORAGE-AUDIT.md)
- [Storage discovery](./STORAGE-DISCOVERY.md)

### HTTP / Edge

- [Security headers — referência](./HEADERS.md)
- [Headers deploy (Cloudflare Worker)](./HEADERS-DEPLOY.md)

## Validação E2E

Scripts em `scripts/security/`:

```bash
bash scripts/security/e2e-anonymous-sensitive-columns.sh
bash scripts/security/e2e-authenticated-sensitive-columns.sh
bash scripts/security/e2e-clickjacking.sh
```

CI: `.github/workflows/security-rls-e2e.yml`.
