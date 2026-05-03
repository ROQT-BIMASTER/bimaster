# Encerramento do hardening — Phases 3 a 6

## Estado atual (verificado no repo)

| Phase | Status |
|---|---|
| 1 — SSRF guard | ✅ entregue |
| 2 — Step-up + Audit log | ✅ entregue (6 funções com `requireStepUp`) |
| 3 — Storage | ⚠️ parcial — `SECURITY-STORAGE-AUDIT.md` existe (40 buckets, 3 públicos), **mas o discovery formal e o STOP-CHECKPOINT pedido pelo usuário ainda não aconteceram** |
| 4 — `mfaFailMode: "closed"` | ⚠️ parcial — 6/10 funções aplicadas (faltam 4 financeiras destrutivas) |
| 5 — Zod `.strict()` | ⚠️ parcial — 14 funções cobertas; **Lote A financeiro incompleto** (boletos-api e erp-export-payment OK; faltam contas-pagar-api, contas-receber-api, lancamentos-cc-api, movimentos-financeiros-api e ~15 outras) |
| 6 — Quarentena TTL | ✅ entregue (`QUARANTINE_TTL_MS = 5_000`) |

## O que este plano executa

### Bloco 1 — Phase 3 discovery (sem migrations)

Criar `docs/SECURITY-STORAGE-DISCOVERY.md` rodando as 3 queries do master prompt (3.1a buckets, 3.1b policies em `storage.objects`, 3.1c volume por bucket) via `supabase--read_query`.

Aplicar a heurística de pré-classificação (logo/brand → manter; nfe/comprovante/boleto/cofre/fiscal → privar TTL ≤5min; anexo/foto/imagem → privar TTL ≤15min; avatar → privar RLS owner; resto → PRECISA DECISÃO).

**STOP**: aguardar aprovação do usuário sobre a classificação antes de qualquer `UPDATE storage.buckets` ou troca de `getPublicUrl` no frontend. (O `SECURITY-STORAGE-AUDIT.md` atual diz que os 3 públicos são intencionais — o discovery vai confirmar ou refutar isso com dados.)

### Bloco 2 — Phase 4 completar (4 funções financeiras destrutivas)

Adicionar `mfaFailMode: "closed"` ao `secureHandler` em:

- `contas-pagar-api`
- `contas-receber-api`
- `lancamentos-cc-api`
- `movimentos-financeiros-api`

Pré-checagem: confirmar que cada uma já roda em `secureHandler` com `requireMfa: true` (ou adicionar). Se a função aceita ops não-destrutivas (GET/list), aplicar `mfaFailMode` apenas no fluxo destrutivo via branching, não globalmente, para não quebrar leituras.

Atualizar `docs/SECURITY-FAIL-CLOSED-MFA.md` com as 4 novas entradas e a matriz de cobertura final (10/10).

### Bloco 3 — Phase 5 Lote A financeiro (escopo desta rodada)

Aplicar Zod `.strict()` + erro `VAL-001` nas funções financeiras prioritárias que ainda não têm:

- `contas-pagar-api`, `contas-pagar-ai-chat`, `contas-pagar-n8n-sync`
- `contas-receber-api`
- `lancamentos-cc-api`
- `movimentos-financeiros-api`
- `processar-transacao-n8n`, `conciliacao-bancaria`
- `erp-fornecedores-sync`, `erp-fornecedores-query`, `erp-sync-engine`, `erp-portadores-api`, `erp-plano-contas-api`, `erp-webhook-inbound`
- `auto-classificar-contas`, `classificar-conta-departamento`, `classificar-contas-batch`, `classificar-contas-lote`, `classificar-contas-pagar-ia`, `classificar-categoria-dre`
- `auditoria-contas-pagar`, `auditoria-contas-receber`
- `cobranca-automation-api`, `cobranca-whatsapp-webhook`

Padrão por função:
- Schema derivado do uso real (inspecionar leituras de `body.*`)
- `z.discriminatedUnion("op", [...])` quando houver multi-op
- `.strict()` em todos os objetos
- `safeParse` + retorno 400 com `VAL-001` e path do campo

Criar `docs/SECURITY-INPUT-VALIDATION.md` com padrão, convenção `VAL-00x` e lista coberta por lote.

**STOP** após Lote A em produção (antes de Lote B admin/segurança e Lote C operacional — esses ficam fora desta rodada, conforme o próprio master prompt).

### Bloco 4 — Reporte consolidado

Após Blocos 1–3, gerar `docs/SECURITY-HARDENING-COMPLETE.md` com:
- Estado de partida vs estado final
- Métricas (RLS, secureHandler, SSRF, step-up, audit log, MFA fail-closed, Zod Lote A)
- Backlog explícito: Phase 5 Lote B + Lote C, Phase 3.3/3.4 dependentes da classificação do usuário
- Próxima auditoria recomendada: 6 meses

## Ordem de execução

1. Bloco 2 (Phase 4) — backend puro, ~1h
2. Bloco 1 (Phase 3 discovery) → **STOP aguardando classificação**
3. Bloco 3 (Phase 5 Lote A) — em paralelo ao STOP do Bloco 1
4. Bloco 4 (reporte) — após 1, 2, 3

## Fora de escopo desta rodada

- Phase 5 Lote B (admin/segurança) — só após Lote A em soak 24h em produção
- Phase 5 Lote C (operacional) — backlog explícito
- Phase 3 etapas 3.3/3.4 (privatização efetiva + troca de `getPublicUrl`) — dependem da resposta do usuário ao discovery

## Riscos e guardrails

- Não alterar `security_audit_log` / `api_security_log` (regra inviolável)
- Não trocar `public=true → false` em nenhum bucket nesta rodada
- Smoke test em cada função Zod modificada: payload extra → 400, payload válido → 200
- Schemas Zod conservadores: começar refletindo o uso atual exato; não introduzir novas regras de negócio disfarçadas de validação
- Em `mfaFailMode: "closed"`, branchar por op destrutiva quando a mesma função serve leituras (evitar 503 em GETs durante incidente de RPC)
