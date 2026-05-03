# MFA Fail-Closed — Phase 4 (final)

## Resumo
O `secureHandler` aceita `mfaFailMode: "open" | "closed"`.
- `"open"` (default): se a RPC `mfa_is_enforced_for_user` falhar, segue o request (preserva disponibilidade).
- `"closed"`: retorna 503 `MFA_CHECK_UNAVAILABLE` — usar em endpoints críticos com identidade de usuário.

## Funções com `mfaFailMode: "closed"` (6/6 elegíveis)

| Função | Razão |
|---|---|
| `create-admin-users` | Privilege escalation — criação de admin |
| `admin-reset-password` | Reset de senha por admin |
| `admin-bulk-set-password` | Reset em lote |
| `delete-admin-user` | Operação irreversível |
| `update-user-password` | Vetor de session hijack |
| `forensic-snapshot` | Acesso a dados forenses sensíveis |

Critério: toda função com `requireStepUp` + identidade de usuário JWT também tem MFA fail-closed.

## Funções financeiras destrutivas — exclusão justificada

As 4 funções financeiras destrutivas previstas no master prompt foram analisadas e **excluídas** de `mfaFailMode: "closed"`:

| Função | Auth atual | Por que não se aplica |
|---|---|---|
| `contas-pagar-api` | `auth: "none"` (API key ERP custom) | Sem JWT → sem `userId` → RPC `mfa_is_enforced_for_user` não é chamada. MFA é responsabilidade do ERP cliente. |
| `contas-receber-api` | `auth: "none"` (API key ERP) | Idem |
| `lancamentos-cc-api` | `auth: "jwt"` mas usa `validateErpAuth` (API key) | Fluxo ERP-to-ERP; usuário humano interage via outras telas |
| `movimentos-financeiros-api` | `auth: "none"` (API key ERP) | Idem |

Mesma lógica usada para excluir `cofre-share` e `export-all-data` (Phase 2): sem identidade de usuário no contexto, MFA não é aplicável. **Mitigação alternativa**: rate-limit por API key + IP allowlist do ERP cliente + logs em `api_security_log`.

## Phase 6 — Quarantine TTL
Reduzido de 30s para 5s no `secure-handler.ts` (constante `QUARANTINE_TTL_MS`).
Trade-off: +6× queries à RPC `is_account_quarantined` no pico, mas janela de bypass pós-quarentena cai de 30s para 5s.

## Cobertura final
- **6/6** funções de gestão de identidade com MFA fail-closed
- **0** funções de identidade de usuário pendentes
- **4** funções ERP fora do escopo (justificadas)
