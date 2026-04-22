

# Validar todos os endpoints da nova API de Contas a Pagar

## Escopo

Testar os 29 endpoints do roteador `contas-pagar-api` em produção, identificar falhas e corrigir o que estiver quebrado **sem alterar contrato público** (sem bump de SDK/OpenAPI/`APP_VERSION`).

## Mapa de endpoints a testar

**Infra / Health (4)**
- `GET /status` (público)
- `GET /stats` (auth)
- `GET /last-sync` (auth ou x-api-key)
- `POST /trigger-n8n` (auth)
- `POST /debug-payload` (admin JWT)

**CRUD (9)**
- `GET /contas-pagar-api` (root list)
- `GET /query`
- `GET /consultar`
- `POST /incluir`
- `PUT /update`
- `DELETE /excluir`
- `POST /upsert`
- `POST /upsert-lote`
- `POST /cancelar` + `POST /cancelar-lote`

**Pagamentos (3)**
- `POST /lancar-pagamento`
- `POST /estornar`
- `GET /pagamentos`

**Parcelas (2)**
- `GET /parcelas`
- `POST /parcelas/sync`

**Anexos (2)**
- `GET /anexos`
- `POST /anexos`

**Sync (6)**
- `POST /bulk-sync`
- `POST /sync-incremental`
- `POST /sync-chunk`
- `POST /sync-complete`
- `GET /chunks-progress`
- `POST /sync` (legado)

## Procedimento

### Fase 1 — Reconhecimento (read-only)

1. Ler `crud-handlers.ts`, `payment-handlers.ts`, `parcela-handlers.ts`, `anexo-handlers.ts`, `sync-handlers.ts` e `utils.ts` para conhecer payloads esperados, validações Zod e respostas.
2. Selecionar 1-2 registros reais de `contas_pagar` via `read_query` para fornecer IDs/`erp_id` válidos aos GETs e fluxo write→read→cancel.
3. Conferir secrets disponíveis (`N8N_API_KEY` para testes com `x-api-key`).

### Fase 2 — Execução dos testes (`curl_edge_functions`)

Para cada endpoint, executar com payload mínimo válido e capturar:
- `status_code`
- `meta.request_id` / `meta.duration_ms`
- erro resumido (se 4xx/5xx)

Ordem de execução pensada para idempotência:

```text
status → stats → last-sync → query → consultar
→ incluir(test_id) → consultar(test_id) → update(test_id)
→ lancar-pagamento(test_id) → pagamentos(test_id) → estornar
→ cancelar(test_id) → excluir(test_id)
→ upsert / upsert-lote (erp_id sintético "TEST-CP-<ts>")
→ parcelas → parcelas/sync → anexos GET
→ chunks-progress → sync-incremental (dryRun se suportado)
→ trigger-n8n (smoke; tolera 400 se webhook não configurado)
→ debug-payload (admin)
```

Cada chamada `write` usa `cCodIntLanc` prefixado `TEST-CP-<timestamp>` para isolamento + cleanup ao final via `excluir`.

### Fase 3 — Diagnóstico

Para falhas (≥400 inesperado, 500, timeout):
- Buscar `request_id` em `edge_function_logs` (`contas-pagar-api`).
- Cross-check em `function_edge_logs` (`status_code`, `execution_time_ms`).
- Se erro PG, identificar pelo código mapeado no `index.ts` (`22P02`, `23503`, `23505`, `23502`, `PGRST*`).

### Fase 4 — Correções (se necessário)

Para cada falha confirmada:
- Patch mínimo no handler shared (`_shared/contas-pagar/*-handlers.ts`) preservando shape de resposta.
- `deploy_edge_functions(["contas-pagar-api"])` e re-teste do endpoint.
- Sem alteração em SDK/OpenAPI/versão (correção interna, não muda contrato).
- Se a correção precisar mudar contrato (improvável), parar e pedir aprovação.

### Fase 5 — Relatório final

Tabela consolidada para o usuário:

| Endpoint | Método | Status | Latência | Observação |
|---|---|---|---|---|
| /status | GET | ok | 45ms | — |
| ... | ... | ... | ... | ... |

Resumo: total testados, total OK, total corrigidos, total bloqueados (com motivo).

## Não-escopo

- Não alterar `secureHandler`, CORS, idempotência, autenticação.
- Não alterar SDK gerado, OpenAPI, `APP_VERSION` nem `ApiDocumentation.tsx`.
- Não criar novos endpoints. Não tocar em `contas-pagar-n8n-sync` (entregue separadamente).
- Não rodar carga (volume real) — apenas smoke + 1 lote pequeno em `upsert-lote`.

## Impacto

**Risco baixo**: testes isolados com `TEST-CP-<ts>` + cleanup. Eventuais correções ficam confinadas aos handlers compartilhados, sem mudança de contrato. Se algum endpoint estiver íntegro, zero arquivos modificados.

