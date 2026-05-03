# Step-up MFA + Audit Log obrigatório nas 8 operações sensíveis

## Objetivo

Exigir re-autenticação MFA (step-up) e gravar audit log em 8 operações críticas que hoje passam só com JWT, sem quebrar produção.

## Descobertas da exploração

- `secureHandler` já implementa `requireStepUp` (linhas 152-199) e valida via RPC `mfa_step_up_validate(_user_id, _scope, _token)`. ✓
- Hoje só `forensic-snapshot` usa step-up.
- As 8 funções existem no diretório `supabase/functions/`. ✓
- Tabelas `step_up_scopes`, `mfa_step_up_tokens`, `security_audit_log` existem.
- **`security_audit_log` NÃO tem as colunas** `empresa_id`, `target_id`, `target_type`, `outcome`, `auth_source`. Só tem: `action`, `severity`, `user_id`, `ip_address`, `user_agent`, `metadata`. Plano: adaptar o helper para usar `metadata` (não criar colunas novas) — minimiza migration e respeita schema atual.
- Hook `useStepUp` expõe API `request(scope, description) → token | null` + `dialogProps` (não `ensureStepUp`). Vamos manter essa API e renomear no prompt.
- Frontend só importa `useStepUp` em `StepUpDialog.tsx` (definição) — **nenhuma página chama hoje**. Ou seja, ligar `requireStepUp` antes do front quebra produção. Por isso o plano é faseado.
- Call sites das 8 funções:
  - `admin-reset-password` / `update-user-password` / `delete-admin-user` / `create-admin-users` → `src/components/configuracoes/GerenciamentoUsuarios.tsx`
  - `cofre-share` → `src/pages/CofreSharePage.tsx`, `src/components/fabrica/CofreFullscreenModal.tsx`
  - `security-admin` → `src/pages/admin/security/SecurityHardeningCenter.tsx`
  - `admin-bulk-set-password`, `export-all-data` → grep não retornou (verificar se há call site; podem ser admin-only via curl/dashboard)

## Plano de execução por lote

### Lote 1 — Infraestrutura (sem mudança de comportamento)

1. **Criar `supabase/functions/_shared/audit-log.ts`** — helper `logSensitiveOperation(ctx, req, entry)`:
   - Insere em `security_audit_log` usando colunas existentes (`action`, `severity`, `user_id`, `ip_address`, `user_agent`, `metadata`).
   - `target_id`, `target_type`, `outcome`, `empresa_id`, `auth_source` vão dentro de `metadata`.
   - Severity derivada: `outcome === "failure" ? "warning" : outcome === "denied" ? "warning" : "info"`.
   - Fire-and-forget com `try/catch` + `console.error`.
2. **Migration: seed `step_up_scopes`** — `INSERT ... ON CONFLICT (scope) DO UPDATE` para os 8 scopes da tabela do prompt.

### Lote 2 — Frontend (habilita UX sem quebrar nada)

3. **Adicionar `<StepUpDialog {...dialogProps} />` montado globalmente** num provider, ou em cada página que precisa. Optar por **wrappers locais** em cada call site para não criar contexto novo.
4. **Atualizar call sites** para chamar `request(scope, description)` antes de `supabase.functions.invoke(...)` e passar `headers: { "x-step-up-token": token }`. Fluxo:
   - `GerenciamentoUsuarios.tsx`: 4 ações (reset, update password, delete, create admin).
   - `CofreSharePage.tsx` + `CofreFullscreenModal.tsx`: ação compartilhar cofre.
   - `SecurityHardeningCenter.tsx`: ações que invocam `security-admin`.
   - Verificar se há UI para `admin-bulk-set-password` / `export-all-data`; se não existe, documentar que só roda via dashboard admin (futuro).
5. **Validar manualmente**: cada call site abre o `StepUpDialog`, captura TOTP, envia header.

### Lote 3 — Funções de senha (alto valor, baixo risco)

6. `admin-reset-password` → `requireStepUp: "user.password.reset"` + `requireMfa: true` + audit success/failure.
7. `admin-bulk-set-password` → `user.password.bulk` + audit.
8. `update-user-password` → `user.password.self` + audit.

### Lote 4 — Funções administrativas

9. `delete-admin-user` → `user.delete` + audit.
10. `create-admin-users` → `user.create.admin` + audit.
11. `security-admin` → `security.admin.config` + audit.

### Lote 5 — Funções de export/share

12. `cofre-share` → `cofre.share` + audit.
13. `export-all-data` → `data.export.bulk` + audit.

### Lote 6 — Validação

14. Smoke test cada função (3 cenários × 8 = 24): sem token → 401 `STEP_UP_REQUIRED`; token inválido → 401 `STEP_UP_INVALID`; token válido → 200 + linha em `security_audit_log`.
15. Rodar `bash scripts/security/e2e-authenticated-sensitive-columns.sh`.
16. Criar `docs/SECURITY-STEPUP-AUDITLOG.md` com tabela de scopes + TTLs + exemplos.

## Detalhes técnicos

### Schema do `security_audit_log` — adaptação

Em vez de `ALTER TABLE` (que toca em tabela já usada por `_shared/rate-limit.ts`, `waf.ts`, etc.), o helper grava:

```ts
await sb.from("security_audit_log").insert({
  user_id: ctx.userId,
  action: entry.action,
  severity: entry.outcome === "success" ? "info" : "warning",
  ip_address: ip,
  user_agent: userAgent,
  metadata: {
    outcome: entry.outcome,
    target_id: entry.target_id,
    target_type: entry.target_type,
    empresa_id: ctx.empresaId,
    auth_source: ctx.authSource,
    ...entry.metadata,
  },
});
```

### Ordem crítica de deploy

Backend (`requireStepUp`) **só vira depois** que frontend já manda o header em produção. Isso significa:
- Lote 2 vai primeiro em produção e fica em soak por algumas horas/dia.
- Lote 3-5 vão um por um, com possibilidade de rollback rápido removendo só a linha `requireStepUp` do config.

### API do `useStepUp` (existente)

Manter o nome `request` (não `ensureStepUp`). Padrão de uso:

```tsx
const { request, dialogProps } = useStepUp();

async function handleReset(userId: string) {
  const token = await request("user.password.reset", "Resetar senha do usuário");
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

## Critério de aceitação

- [ ] 8 funções com `requireStepUp` ativo e audit log em sucesso/falha.
- [ ] 8 scopes em `step_up_scopes`.
- [ ] Helper `_shared/audit-log.ts` testado.
- [ ] Frontend de cada call site captura TOTP via `StepUpDialog`.
- [ ] Smoke test 3×8 = 24 cases passa.
- [ ] E2E `security-rls-e2e` continua verde.
- [ ] `docs/SECURITY-STEPUP-AUDITLOG.md` publicado.
