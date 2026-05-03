# MFA Fail-Closed — Phase 4

## Resumo
O `secureHandler` agora suporta `mfaFailMode: "open" | "closed"`.
- `"open"` (default): se a RPC `mfa_is_enforced_for_user` falhar, segue request (preserva disponibilidade).
- `"closed"`: retorna 503 `MFA_CHECK_UNAVAILABLE` — usar em endpoints críticos.

## Funções com `mfaFailMode: "closed"`
- `create-admin-users`
- `admin-reset-password`
- `admin-bulk-set-password`
- `delete-admin-user`
- `update-user-password`
- `forensic-snapshot`

Critério: todas as funções que já exigem `requireStepUp` (operações sensíveis de gestão de identidade) também devem ter MFA fail-closed.

## Phase 6 — Quarantine TTL
Reduzido de 30s para 5s no `secureHandler.ts` (constante `QUARANTINE_TTL_MS`).
Trade-off: +6× queries à RPC `is_account_quarantined` no pico, mas janela de bypass pós-quarentena cai de 30s para 5s.
