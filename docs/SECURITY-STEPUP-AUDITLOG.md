# Step-up MFA + Audit Log obrigatório

Esta página documenta as 8 operações sensíveis governadas por step-up MFA e
audit log obrigatório.

## Status atual

- **Audit log**: ativo em todas as 8 funções via `_shared/audit-log.ts` →
  grava em `security_audit_log` (sucesso, falha, denied).
- **Step-up enforcement**: ATIVO no backend para as 5 funções de gerenciamento
  de usuário/senha. Frontend (`GerenciamentoUsuarios`) já solicita o token
  via `useStepUp` e envia em `x-step-up-token`.

## Tabela de scopes

| Função                    | Scope                      | TTL (s) | Step-up backend |
|---------------------------|----------------------------|---------|-----------------|
| `admin-reset-password`    | `user.password.reset`      | 300     | Ativo           |
| `admin-bulk-set-password` | `user.password.bulk`       | 60      | Ativo           |
| `update-user-password`    | `user.password.self`       | 600     | Ativo           |
| `delete-admin-user`       | `user.delete`              | 60      | Ativo           |
| `create-admin-users`      | `user.create.admin`        | 300     | Ativo           |
| `security-admin` (POST)   | `security.admin.config`    | 60      | Validação interna (compat) |
| `cofre-share`             | `cofre.share`              | 300     | N/A (acesso externo via token) |
| `export-all-data`         | `data.export.bulk`         | 60      | N/A (apikey n8n)               |

## Helper de audit log

```ts
import { logSensitiveOperation } from "../_shared/audit-log.ts";

await logSensitiveOperation(ctx, req, {
  action: "user.password.reset",
  target_id: userId,
  target_type: "user",
  outcome: "success", // | "failure" | "denied"
  metadata: { /* campos não-sensíveis */ },
});
```

Grava em `security_audit_log`. Campos extras (`target_id`, `target_type`,
`outcome`, `empresa_id`, `auth_source`) ficam dentro de `metadata` para
não exigir migration na tabela compartilhada.

## Padrão frontend (a aplicar)

```tsx
const { request, dialogProps } = useStepUp();

async function handleReset(userId: string) {
  const token = await request("user.password.reset", "Resetar senha");
  if (!token) return;
  await supabase.functions.invoke("admin-reset-password", {
    body: { userId, newPassword },
    headers: { "x-step-up-token": token },
  });
}

return (<>
  <Button onClick={() => handleReset(id)}>Resetar</Button>
  <StepUpDialog {...dialogProps} />
</>);
```

## Como ativar enforcement (após wiring do frontend)

Em cada função, descomentar:

```ts
// requireMfa: true,
// requireStepUp: "user.password.reset",
```

Smoke test esperado:

| Cenário                         | Status | Code              |
|--------------------------------|--------|-------------------|
| Sem `x-step-up-token`          | 401    | `STEP_UP_REQUIRED`|
| Token inválido/expirado        | 401    | `STEP_UP_INVALID` |
| Token válido                   | 200    | + linha em `security_audit_log` |

## Verificação

```sql
SELECT action, metadata->>'outcome' AS outcome, count(*)
FROM security_audit_log
WHERE created_at > now() - interval '24 hours'
GROUP BY 1, 2
ORDER BY 1, 2;
```
