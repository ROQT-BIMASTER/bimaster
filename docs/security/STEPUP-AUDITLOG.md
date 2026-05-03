# Step-up MFA + Audit Log obrigatório

Esta página documenta as 8 operações sensíveis governadas por step-up MFA e
audit log obrigatório.

## Status atual (Phase 2 — concluída)

- **Audit log**: ativo em todas as 8 funções via `_shared/audit-log.ts`.
- **Step-up enforcement**: ATIVO no backend para 6 funções (5 de senha/admin via
  `secureHandler` + `security-admin` via validação interna por op). Frontend
  (`GerenciamentoUsuarios`, `SecurityHardeningCenter`) já solicita o token via
  `useStepUp` e envia em `x-step-up-token`.
- **`cofre-share` (read)** e **`export-all-data` (n8n)**: documentadas como
  exclusões justificadas (ver "Decisões" abaixo).

## Tabela de scopes

| Função                    | Scope                      | TTL (s) | Step-up backend |
|---------------------------|----------------------------|---------|-----------------|
| `admin-reset-password`    | `user.password.reset`      | 300     | Ativo (secureHandler) |
| `admin-bulk-set-password` | `user.password.bulk`       | 60      | Ativo (secureHandler) |
| `update-user-password`    | `user.password.self`       | 600     | Ativo (secureHandler) |
| `delete-admin-user`       | `user.delete`              | 60      | Ativo (secureHandler) |
| `create-admin-users`      | `user.create.admin`        | 300     | Ativo (secureHandler) |
| `security-admin` (POST)   | `security.admin.config`    | 60      | **Ativo** (validação por op mutating: `quarantine`/`release`/`verify_chain`) |
| `cofre-share` (GET)       | `cofre.share`              | 300     | **N/A** — endpoint de leitura por token público anônimo (ver Decisão 1) |
| `export-all-data`         | `data.export.bulk`         | 60      | **N/A** — autenticado por `X-API-Key` (n8n), sem identidade humana (ver Decisão 2) |

## Decisões documentadas

### Decisão 1 — `cofre-share` não exige step-up

**Caller real:** página pública `/cofre-share?token=...` aberta no navegador
de fornecedores externos (não-usuários do sistema). A função recebe apenas
um token opaco e devolve metadados + signed URLs dos documentos liberados.

**Por que não step-up:** o fluxo é anônimo por design. Não há sessão MFA
do destinatário, e o admin que **gera** o token não passa pela função —
ele faz `INSERT` direto em `cofre_share_tokens` via RLS no
`CofreFullscreenModal.tsx`. Auditoria desse INSERT já é feita por
`auditShare()` em `sensitive-audit.ts`.

**Defesa em profundidade existente:** rate limit IP (10/min), TTL 48h, max
50 acessos por token, RLS em `cofre_share_tokens` requer admin para criar.

**Quando passaria a exigir:** se a geração do token migrar para uma edge
function (em vez de INSERT direto), ativar `requireStepUp: "cofre.share"`
nessa nova função.

### Decisão 2 — `export-all-data` não exige step-up

**Caller real:** apenas n8n (verificado via grep no frontend — única
referência em `RelatorioAPIs.tsx` é texto de documentação, sem
`supabase.functions.invoke`).

**Por que não step-up:** a função autentica por `X-API-Key` validado contra
`N8N_API_KEY` (secret). Não há `userId` no contexto, então não há a quem
pedir TOTP.

**Defesa em profundidade existente:** API key dedicada, rate limit
(`secureHandler` 10/min), `auth: "none"` + validação manual de header,
audit log obrigatório em todas as chamadas (sucesso e falha) via
`logSensitiveOperation` + `api_access_log`.

**Quando passaria a exigir:** se for criada UI de admin para auto-export
disparada por humano logado, criar nova função `admin-export-bulk` com
`auth: "jwt", requireMfa: true, requireStepUp: "data.export.bulk"`. A
função atual continua como endpoint exclusivo n8n.

## Helper de audit log

```ts
import { logSensitiveOperation } from "../_shared/audit-log.ts";
await logSensitiveOperation(ctx, req, {
  action: "user.password.reset",
  target_id: userId, target_type: "user",
  outcome: "success", // | "failure" | "denied"
  metadata: { /* campos não-sensíveis */ },
});
```

## Padrão frontend

```tsx
const { request, dialogProps } = useStepUp();
async function handleAction() {
  const token = await request("security.admin.config", "Confirme para...");
  if (!token) return;
  await fetch(url, { headers: { ...headers, "x-step-up-token": token }, ... });
}
return (<>...<StepUpDialog {...dialogProps} /></>);
```

## Verificação

```sql
SELECT action, metadata->>'outcome' AS outcome, count(*)
FROM security_audit_log
WHERE created_at > now() - interval '24 hours'
GROUP BY 1, 2 ORDER BY 1, 2;
```

## Smoke tests Phase 2 — `security-admin`

| Cenário                                  | Status | Code              |
|------------------------------------------|--------|-------------------|
| POST `quarantine` sem `x-step-up-token`  | 401    | `STEP_UP_REQUIRED`|
| POST `quarantine` com token inválido     | 401    | `STEP_UP_INVALID` |
| POST `quarantine` com token válido       | 200    | + audit success   |
| GET `kpis`/`events` (sem token)          | 200    | leitura permitida |
