# Security Hardening — Encerramento da Campanha (2026-05-03)

## Estado final por phase

| Phase | Escopo | Status | Documento |
|---|---|---|---|
| 1 | SSRF guard em funções com URL dinâmica | ✅ Concluído | `SECURITY-SSRF-COVERAGE.md` |
| 2 | Step-up MFA + Audit log em ops sensíveis | ✅ Concluído (6/6 elegíveis) | `SECURITY-STEPUP-AUDITLOG.md` |
| 3 | Storage signed URLs + auditoria + privatização + limites | ✅ Concluído | `SECURITY-STORAGE-DISCOVERY.md`, `SECURITY-STORAGE-AUDIT.md` |
| 4 | MFA fail-closed em ops críticas | ✅ Concluído (6/6 elegíveis) | `SECURITY-FAIL-CLOSED-MFA.md` |
| 5 | Zod `.strict()` input validation | ✅ Lote A.1 (6 funções) + 14 cobertas em rodadas anteriores | `SECURITY-ZOD-STRICT-COVERAGE.md`, `SECURITY-INPUT-VALIDATION.md` |
| 6 | Quarantine TTL 30s → 5s | ✅ Concluído | `SECURITY-FAIL-CLOSED-MFA.md` § Phase 6 |

## Métricas finais

| Métrica | Valor |
|---|---|
| Edge Functions com `secureHandler` | 217+ |
| Funções com SSRF guard | 7 ativas + ~25 exclusões justificadas |
| Funções com `requireStepUp` | 6 |
| Funções com audit log estruturado | 6 (gestão de identidade) |
| Funções com `mfaFailMode: "closed"` | 6 |
| Funções com Zod `.strict()` | 20 (6 Lote A.1 + 14 anteriores) |
| Buckets de storage | 40 (2 públicos intencionais, 38 privados) |
| Quarantine TTL | 5s (era 30s) |

## Backlog explícito

### Phase 3 — ✅ Concluída
Todas as 4 perguntas do discovery foram respondidas e aplicadas (ver `SECURITY-STORAGE-DISCOVERY.md` § STOP RESPONDIDO):
- creative-studio privatizado (signed URL 24h on-demand)
- INSERT policies com prefixo UID em trade-assets, email-assets (creative-studio já tinha)
- file_size_limit + allowed_mime_types em 40/40 buckets
- TTL ≤300s em 7 buckets fiscais (frontend + edge)

### Phase 5 Lote A.2 — Routers complexos
PR dedicado por função (multi-op com `discriminatedUnion`):
- `contas-pagar-api`, `contas-pagar-ai-chat`, `contas-pagar-n8n-sync`
- `lancamentos-cc-api`, `movimentos-financeiros-api`
- `processar-transacao-n8n`, `conciliacao-bancaria`
- `erp-fornecedores-sync`, `erp-fornecedores-query`, `erp-sync-engine`, `erp-portadores-api`, `erp-plano-contas-api`
- `classificar-contas-lote`
- `cobranca-automation-api`, `cobranca-whatsapp-webhook`

### Phase 5 Lote B — Admin/segurança (~15 funções)
Após soak de 24h em produção do Lote A.

### Phase 5 Lote C — Operacional (~80 funções)
Backlog longo prazo, 1–2 PRs por sprint.

### C3 — Cloudflare Worker
Headers de segurança em `bimaster.online` deploy manual via `npx wrangler deploy` (ver `mem://infra/cloudflare-worker-deploy`).

## Funções fora de escopo (justificadas)

| Função | Auth | Motivo |
|---|---|---|
| `cofre-share` | anon | Token em URL é a credencial; sem userId no contexto |
| `export-all-data` | API key n8n | Sem usuário humano; rate-limit por API key |
| `contas-pagar-api`, `contas-receber-api`, `lancamentos-cc-api`, `movimentos-financeiros-api` | API key ERP | Sem userId → MFA não aplicável; mitigado por API key + IP allowlist |

## Próxima auditoria recomendada

**6 meses (2026-11-03)** — escopo:
1. Re-rodar discovery de `storage.buckets` (verificar novos buckets criados sem RLS)
2. Validar que Lote A.2 e Lote B do Zod foram absorvidos
3. Re-rodar `bash scripts/security/e2e-authenticated-sensitive-columns.sh` em CI
4. Auditar `pg_policy` em `storage.objects` por bucket público
5. Revisar `mfaFailMode` para novas funções de gestão de identidade
6. Revalidar exclusões SSRF (algum hardcoded URL virou parametrizável?)

## Rollback consolidado

| Phase | Comando |
|---|---|
| 1 | Remover chamada `validateExternalUrl` por função |
| 2 | Remover `requireStepUp` + reverter handlers no frontend |
| 3 | `UPDATE storage.buckets SET public = true WHERE id = '<bucket>'` (não aplicado nesta rodada) |
| 4 | Remover `mfaFailMode: "closed"` do config |
| 5 | Remover schema + `safeParse` por função |
| 6 | `QUARANTINE_TTL_MS = 30_000` |

Todos os rollbacks são por-função, sem migrations a reverter.

---

**Campanha encerrada.** Próximas ações dependem de decisão do usuário (Phase 3) ou ciclo regular de PR (Lote A.2 / B / C).
