

# Auditoria de Prontidão Regulatória — APIs Portal de Contas a Pagar

Bateria completa de testes em **caixa-preta + caixa-branca** nos 16 endpoints públicos do Portal ERP, simulando exatamente o que um auditor externo executaria. Zero mudança de contrato; correções (se houver) são patches internos preservando shape de resposta.

## Escopo: 16 endpoints públicos

| Categoria | Endpoints |
|---|---|
| Consulta & Gestão | `GET /query`, `GET /status`, `PUT /update`, `POST /cancelar`, `POST /cancelar-lote` |
| Integração CRUD | `GET /consultar`, `POST /incluir`, `DELETE /excluir`, `POST /upsert`, `POST /upsert-lote`, `POST /lancar-pagamento` |
| Parcelas / Pagamentos / Anexos | `GET /parcelas`, `POST /parcelas/sync`, `GET /pagamentos`, `POST /estornar`, `GET /anexos`, `POST /anexos` |

## Matriz de testes por endpoint (3 níveis)

Para cada endpoint, executar **3 baterias**:

### Nível 1 — Funcional (happy-path)
- Payload mínimo válido → esperado 2xx + shape exato.
- Verificar campos obrigatórios da resposta (`success`, `data`, `meta_relacionados`, `pagination`, `meta.duration_ms`, `meta.processed_at`).

### Nível 2 — Validação Zod / contrato
- Campo obrigatório ausente → 400 com `error: 'campo_obrigatorio'` ou `VALIDATION_ERROR`.
- Tipo errado (ex: UUID inválido, data malformada, valor negativo) → 400 com mensagem clara.
- Mass-assignment: enviar campos não-allowlist no `/update` → confirmar que são silenciosamente descartados (não persistem).

### Nível 3 — Segurança & governança
- **Auth ausente** → 401 `Unauthorized`.
- **Auth inválida** (API Key falsa / JWT expirado) → 401.
- **Idempotência**: repetir POST de `/incluir`, `/upsert`, `/lancar-pagamento`, `/cancelar`, `/estornar` com mesmo `Idempotency-Key` → segunda chamada devolve resposta cacheada (sem efeito colateral).
- **Governança AP** (regra do mem://finance/contas-pagar-governance-and-audit-standard):
  - Tentar `/update` em título com status `pago` → bloqueio.
  - Tentar `/update` em título `cancelado` → bloqueio.
  - Tentar `/cancelar` em título `pago` → bloqueado com mensagem "use /estornar primeiro".
  - Tentar `/lancar-pagamento` em título `cancelado` → bloqueio.
- **RLS / multi-tenant**: confirmar que API Key de empresa A não vê título de empresa B em `/query` e `/consultar`.

## Procedimento

### Fase 1 — Inventário de fixtures
1. `read_query` para selecionar:
   - 1 título `pendente` real (fluxo write→pay→reverse→cancel).
   - 1 título `pago` (testes de bloqueio governança).
   - 1 título `cancelado` (testes de bloqueio update/pagamento).
   - 1 `empresa_id`, 1 `categoria_codigo` válido, 1 `fornecedor_codigo` válido.
2. Conferir API Key de teste disponível em `erp_config` ou usar JWT do usuário logado.

### Fase 2 — Execução dos 16 × 3 = 48 cenários

Ordem otimizada para isolamento (prefixo `AUDIT-CP-<ts>`):

```text
[Read-only first]
GET /status → GET /query → GET /consultar → GET /parcelas → GET /pagamentos → GET /anexos

[Write lifecycle on synthetic record]
POST /incluir(AUDIT-CP-1) → GET /consultar(AUDIT-CP-1) → PUT /update(AUDIT-CP-1)
→ POST /lancar-pagamento(parcial) → GET /pagamentos(AUDIT-CP-1)
→ POST /estornar → POST /cancelar(AUDIT-CP-1) → DELETE /excluir(AUDIT-CP-1)

[Batch + governance]
POST /upsert(AUDIT-CP-2) → POST /upsert-lote(AUDIT-CP-3..5)
→ POST /cancelar-lote(AUDIT-CP-3,4,5)
POST /parcelas/sync(AUDIT-CP-2)
POST /anexos(AUDIT-CP-2)

[Governance violations — esperado bloqueio]
PUT /update sobre título pago → 4xx
POST /cancelar sobre título pago → 4xx ("use /estornar")
POST /lancar-pagamento sobre cancelado → 4xx

[Idempotência — header Idempotency-Key]
POST /incluir x2 (mesmo key) → segunda devolve cache
POST /lancar-pagamento x2 → segunda devolve cache
POST /cancelar x2 → segunda devolve cache

[Validação Zod — payload inválido]
POST /incluir sem fornecedor → 400
GET /query com cursor mal-formado → 400
POST /anexos sem conta_pagar_id → 400
```

Capturar para cada chamada: `status_code`, `meta.request_id`, `meta.duration_ms`, primeiros 200 chars do body, `RateLimit-Remaining`.

### Fase 3 — Cross-check em logs
- `edge_function_logs` (`contas-pagar-api`): casar `request_id` com cenários para confirmar paths.
- `function_edge_logs`: validar latência `< 1000ms` em GETs simples e `< 2000ms` em batch.
- Conferir trilha em `api_audit_log` (entrada gerada via `logApiAccess`) — exigido em auditoria.

### Fase 4 — Correções (apenas se algo falhar)
- Patch mínimo no handler shared correspondente (`crud-handlers.ts`, `payment-handlers.ts`, `parcela-handlers.ts`, `anexo-handlers.ts`).
- Preservar shape de resposta exato.
- Sem bump de SDK / OpenAPI / `APP_VERSION`.
- Re-deploy e re-teste do cenário falho.
- Se a correção exigir mudar contrato → parar e pedir aprovação antes de prosseguir.

### Fase 5 — Cleanup
- `DELETE /excluir` em todos os `AUDIT-CP-*` que sobreviveram.
- `POST /cancelar-lote` para os que não puderem ser excluídos (já com pagamento).
- Confirmar com `read_query` que não restou nenhum registro com prefixo `AUDIT-CP-` em `contas_pagar`.

### Fase 6 — Relatório de prontidão regulatória

Tabela final consolidada:

| # | Endpoint | Método | Funcional | Validação | Segurança/Gov | Idempotência | Latência (ms) | Observação |
|---|---|---|---|---|---|---|---|---|
| 1 | /status | GET | ok | n/a | n/a | n/a | 45 | — |
| ... | ... | ... | ... | ... | ... | ... | ... | ... |

Resumo final:
- **Total de cenários**: 48
- **Aprovados**: X
- **Falhas críticas**: Y (com link de correção aplicada)
- **Aviso de risco regulatório**: Z (se houver — ex.: rate limit baixo demais para volume esperado)

## Não-escopo

- `secureHandler`, WAF, CORS, idempotência centralizada, RLS — não tocar.
- SDK, OpenAPI, `APP_VERSION`, `ApiDocumentation.tsx` — sem bump.
- Endpoints internos N8N (`/bulk-sync`, `/sync*`, `/trigger-n8n`, `/debug-payload`) — fora do escopo (não são públicos).
- Carga real / volume (auditor avalia conformidade, não throughput).

## Impacto

**Risco baixo**: testes isolados com prefixo `AUDIT-CP-<ts>` e cleanup garantido. Se nenhum endpoint falhar, **zero arquivos modificados**. Se houver falha, patch interno mínimo no handler shared, sem alteração de contrato — auditor enxerga API estável e versão única.

