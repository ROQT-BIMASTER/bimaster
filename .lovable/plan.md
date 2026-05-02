## Estado real (auditado agora)

O finding está desatualizado em relação ao código atual. Reauditei e o quadro é:

| Frente | Finding | Estado real | Gap real |
|---|---|---|---|
| A1 | 21 funções com `Allow-Origin: *` | **1** (`shipsgo-webhook`, wildcard intencional para webhook HMAC público) | 0 — encerrado |
| A2 | 153/223 sem `secureHandler` | **145/223** sem `secureHandler` | 145 funções, mas só **52 totalmente abertas** (sem qualquer auth) |
| A3 | 844 `console.*` | **686** em 142 arquivos (financeiras já migradas) | 686 chamadas — risco PII residual |

## Triagem das 145 funções sem `secureHandler`

- **22 webhooks** (`*-webhook`, `auth-email-hook`, `whatsapp-business-api`, `erp-webhook-inbound`, `phyllo-webhook`, etc.) — autenticam via assinatura HMAC ou secret no header. **Não devem** entrar no `secureHandler` padrão (rate-limit por IP quebra cron/n8n; CORS é irrelevante para server-to-server). Fica documentado como exceção.
- **71 funções com auth manual** (`getClaims`, `validateAnyAuth`, `x-api-key`) — já protegidas, mas sem rate-limit, WAF L7 nem security headers padronizados. Migrar é desejável mas não urgente.
- **52 funções totalmente abertas** — sem qualquer validação. **Risco real.** Lista em `/tmp/totally_open.txt`. Inclui geradores de IA caros (`generate-banner-image`, `generate-product-creative`, `generate-video`, `nano-banana-video`, `pollo-generate-image`, `huggs-agent-chat`), exports (`export-pdf`, `export-all-data`), e várias APIs ERP (`erp-fornecedores-query`, `erp-plano-contas-api`, `erp-portadores-api`, `contas-correntes-api`, `lancamentos-cc-api`, `orcamentos-caixa-api`).

## Plano em 3 ondas

### Onda 1 — A2 crítico: 52 funções totalmente abertas

Wrap em `secureHandler` com mode adequado. Categorizo:

**Bloco 1.1 — IA/geração (auth=jwt, rateLimit=10rpm, IA cara)**
`ai-creative-studio`, `ai-analytics`, `analyze-brand-website`, `analyze-comments-sentiment`, `analyze-competitor-photo`, `analyze-gondola-competition`, `analyze-shelf-photos`, `analyze-whatsapp-sentiment`, `extrair-ingredientes-ia`, `extrair-insumos-imagem`, `generate-banner-image`, `generate-product-creative`, `generate-video`, `nano-banana-video`, `pollo-generate-image`, `optimize-display-banner`, `huggs-agent-chat`, `importar-briefing-ia`, `qa-agent`, `gerar-despacho-oficial`, `parse-china-excel`, `ai-map-csv-columns`, `research-influencer-reputation`, `suggest-form-fields`, `sugerir-municipios-vendedor`

**Bloco 1.2 — APIs ERP / dados (auth=jwt, rateLimit=60rpm)**
`erp-fornecedores-query`, `erp-plano-contas-api`, `erp-portadores-api`, `contas-correntes-api`, `lancamentos-cc-api`, `orcamentos-caixa-api`, `classificar-contas-lote`, `padronizar-municipio`, `social-media-metrics`

**Bloco 1.3 — Exports (auth=jwt, rateLimit=10rpm)**
`export-pdf`, `export-all-data`

**Bloco 1.4 — Filas/cron internos (auth=apikey, sem rate-limit)**
`process-email-queue`, `process-photo-analysis-queue`, `projeto-copilot-cleanup`, `projeto-monitor-atrasos`, `trigger-photo-queue`, `ibge-sync`, `audit-briefing-tarefa`, `audit-china-vinculo`, `audit-produto-tarefa`

**Bloco 1.5 — Form público / utilitários (auth=any + validação interna)**
`team-form-submit` (form público — manter sem JWT mas adicionar rate-limit + WAF), `health` (endpoint de healthcheck — `auth=any, rateLimit=120rpm`), `handle-email-unsubscribe` (link em email — `auth=any` + validação de token interno), `preview-transactional-email` (admin-only — `auth=jwt, rateLimit=20`), `send-transactional-email` (já tem secret de API, migrar para `auth=apikey`)

**Bloco 1.6 — Webhooks que vazaram para a lista** (revisar caso a caso)
`whatsapp-business-api`, `auth-email-hook`, `security-correlation-engine` — verificar se realmente são chamados por terceiros ou se podem usar `secureHandler` com `auth=apikey`.

### Onda 2 — A3: codemod de `console.*` → `logger.*` nas 142 funções restantes

Reusar o helper `supabase/functions/_shared/logger.ts` (já criado na onda anterior). Codemod automatizado:

```bash
# pseudo
for f in supabase/functions/*/index.ts; do
  sed -i 's/\bconsole\.\(log\|info\|debug\|warn\|error\)\b/logger.\1/g' "$f"
  # adicionar import se não houver
done
```

Excluir do codemod: `_shared/logger.ts` (o próprio helper) e `_shared/secure-handler.ts` (precisa logar erros do middleware).

Verificação: `rg "console\.(log|info|debug|warn|error)" supabase/functions --type ts | wc -l` deve cair de 686 para ~5 (apenas helpers internos legítimos).

### Onda 3 — A2 não-crítico: as ~71 funções com auth manual

Migrar progressivamente para `secureHandler({ auth: "jwt", ... })` removendo a validação manual duplicada. Ganho: rate-limit, WAF L7, security headers e logs uniformes. Como já têm auth, **não é bloqueante** — fica como débito técnico em PR separado, fora deste plano.

## Documentação

Atualizar `docs/SECURITY-EDGE-FUNCTIONS-HARDENING.md` com:
- Lista das 52 funções migradas (Onda 1) com modo de auth aplicado.
- Confirmação de A1 encerrado (apenas `shipsgo-webhook` exceção HMAC).
- Status A3: 686 → ~5 chamadas `console.*` restantes.
- Lista das 22 funções **fora do `secureHandler` por design** (webhooks HMAC) com justificativa.

Atualizar `docs/SECURITY-CORS-LOCKDOWN.md` confirmando lote 2 fechado.

## Fora deste plano

- Onda 3 (migração das 71 funções com auth manual) — débito técnico, sem risco direto.
- Refactor de `shipsgo-webhook` para usar `secureHandler` em modo HMAC (precisaria de novo modo no wrapper — mudança de infra, não cabe aqui).

## Validação

Ao final:
```bash
rg "Access-Control-Allow-Origin.*\*" supabase/functions --type ts        # 1 (shipsgo)
rg -L "secureHandler" supabase/functions/*/index.ts | wc -l               # 145 - 52 = 93 (todas com auth manual ou webhooks)
rg "console\.(log|info|debug|warn|error)" supabase/functions --type ts | wc -l  # ~5
```

Sem `bun run build` manual (harness Lovable cuida).
