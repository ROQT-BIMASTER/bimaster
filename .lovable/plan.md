# Plano de Hardening Profundo de Segurança

## Status — v3.4.69 (rollout final)

- **Fase 1** (DB + Audit + Quarentena + SIEM base): CONCLUÍDA (v3.4.67)
- **Fase 2** (MFA TOTP + Step-up tokens): CONCLUÍDA (v3.4.68)
- **Fase 3** (WAF v2 — Geo/ASN + Bot signals): **ATIVA EM SHADOW MODE** (v3.4.69)
- **Fase 4** (CSP defesa em profundidade no cliente): CONCLUÍDA (v3.4.68)
- **Fase 5** (PII / LGPD): helpers `mask_cpf`/`mask_email` (v3.4.68)
- **Fase 6** (SIEM correlation engine): CONCLUÍDA (v3.4.68)
- **Fase 7** (DR + CI gates): **RUNBOOK ATIVO + DRILL SCHEDULED** (v3.4.69)

## v3.4.69 — Rollout Final

### MFA obrigatório (admin/gerente) com grace period 7 dias

- Tabela `mfa_grace_periods` registra início automático no primeiro acesso após v3.4.69.
- Função `mfa_is_enforced_for_user(uuid)` retorna `true` apenas após o grace expirar.
- Backend: `secure-handler` rejeita com `403 MFA_REQUIRED` quando enforce ativo.
- Frontend: `<MfaGate />` global no `DashboardLayout` mostra:
  - Aviso amarelo durante o grace ("MFA será obrigatório em N dias").
  - Aviso vermelho destrutivo após expirar.
- Recovery: cada usuário recebe 10 recovery codes no enrollment.
- Lockout: admin pode resetar via `security-admin` (revogar enrollment do usuário).

### Step-up enforcement nas ações sensíveis

Escopos seed (tabela `step_up_scopes`):

| scope                  | descrição                                  | TTL    |
|------------------------|--------------------------------------------|--------|
| `export.data`          | Exportações em massa (CSV/XLSX/PDF)        | 15 min |
| `user.management`      | Criar/editar usuários, roles, impersonation| 15 min |
| `finance.sensitive`    | Pagamentos, transferências                  | 5 min  |
| `municipios.write`     | Criar/reatribuir municípios                | 15 min |

Como aplicar em uma Edge Function:

```ts
serve(secureHandler({
  auth: "jwt",
  rateLimitPrefix: "export-relatorio",
  requireStepUp: "export.data",
}, async (req, ctx) => { ... }));
```

Frontend:

```ts
const { request, dialogProps } = useStepUp();
const token = await request("export.data", "Exportar planilha financeira");
if (!token) return;
await supabase.functions.invoke("relatorio-export", {
  body: { ... },
  headers: { "x-step-up-token": token },
});
// e renderizar <StepUpDialog {...dialogProps} />
```

### WAF v2 — Shadow Mode (48h)

- Nova tabela `waf_runtime_config` com modo `shadow|enforce|off` (padrão: `shadow`).
- Engine `_shared/waf.ts` agora avalia:
  - Geo policy (`waf_geo_policy`) via headers `cf-ipcountry` / `x-vercel-ip-country`.
  - Bot signals heurísticos (UA missing/curto, headless, sem accept-language).
  - Padrões SQLi/XSS/path traversal (já existentes).
- Em **shadow**: infrações são logadas em `security_audit_log` com `action='waf_shadow'`, mas a request passa.
- Após 48h analisando logs, alterar para `enforce`:
  ```sql
  UPDATE public.waf_runtime_config SET mode = 'enforce', updated_by = auth.uid() WHERE id = 1;
  ```
- Cache de 30s no edge — propagação rápida sem deploy.

### Disaster Recovery — RPO 15min / RTO 1h

**RPO (Recovery Point Objective)**: 15 minutos — Supabase PITR contínuo.
**RTO (Recovery Time Objective)**: 1 hora — restore para projeto irmão + flip de DNS.

#### Runbook PITR

1. **Detecção** (alerta SIEM ou suporte) — registrar em `dr_drill_log` com `started_at`.
2. **Decisão** (Engineering Lead, < 15 min) — restore vs hotfix.
3. **Restore PITR** (Supabase Cloud → Database → Backups → Restore to point-in-time).
4. **Flip DNS** (custom domain → projeto restaurado).
5. **Validação** (smoke test: login, leitura crítica, gravação simples).
6. **Comunicação** (status page + notificação interna).
7. **Post-mortem** — atualizar `dr_drill_log.finished_at`, `outcome`, `notes`.

#### Drill em projeto irmão (executar mensalmente)

Use `scripts/dr/drill.sh` (modo dry-run por padrão). Ele:

- Cria registro em `dr_drill_log` com `scenario='monthly_drill'`.
- Mede tempos das etapas (PITR list → restore → validação).
- Calcula `rpo_minutes` e `rto_minutes` reais.
- Atualiza o registro com `outcome` e `notes`.

Próximo drill agendado: **primeira segunda do mês, 02:00 BRT**.

## Observações

- A função `mfa_step_up_validate` é `SECURITY DEFINER` restrita a `service_role` (não pode ser chamada do cliente).
- O cache de quarentena/WAF (30s) garante latência baixa sem comprometer tempo de reação.
- Linter ainda reporta 287 warnings legados (extensions in public, definers da fase 1) — não regrediram.
