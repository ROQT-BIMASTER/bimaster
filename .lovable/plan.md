

# Análise: APIs Contas a Pagar — O que falta para cobertura completa

## O que já existe

| API | Direção | Funcionalidade |
|---|---|---|
| `contas-pagar-api` | ERP → BiMaster | Sync em massa: /sync, /bulk-sync, /sync-incremental, /sync-complete, /status, /stats, /last-sync, /trigger-n8n |
| `contas-pagar-export-api` | BiMaster → ERP (pull) | GET /pending (provisão), GET /paid (baixa), GET /cancelled, POST /confirm, GET /status |
| `erp-export-payment` | BiMaster → ERP (push) | Export individual via n8n, rest_api, sql_direct |
| `erp-webhook-inbound` | ERP → BiMaster | Callbacks: provisao_registrada, baixa_confirmada, estorno_processado, erro_processamento |

## O que falta

### 1. Consulta avançada de títulos (GET com filtros)
O endpoint `GET /contas-pagar-api` atual retorna apenas os 100 últimos registros sem filtros. O ERP precisa consultar por:
- `empresa_id`, `fornecedor_codigo`, `status`, `data_vencimento_de/ate`, `data_emissao_de/ate`
- Paginação (`limit`, `offset`)
- Ordenação customizada

**Endpoint**: `GET /contas-pagar-api/query?empresa_id=8&status=pendente&vencimento_de=2026-01-01&limit=500`

### 2. Consulta/Sync de Parcelas
A tabela `parcelas` está vinculada a `contas_pagar` mas não tem API. O ERP precisa:
- Listar parcelas de um título: `GET /contas-pagar-api/parcelas?conta_pagar_id=uuid`
- Sync de parcelas do ERP: `POST /contas-pagar-api/parcelas/sync`

### 3. Consulta/Sync de Pagamentos
A tabela `pagamentos` registra baixas individuais mas não tem API para o ERP:
- Listar pagamentos: `GET /contas-pagar-api/pagamentos?conta_pagar_id=uuid`
- Registrar pagamento via API: `POST /contas-pagar-api/pagamentos`

### 4. Atualização individual de título
Não existe endpoint para o ERP atualizar campos de um título existente (ex: alterar vencimento, valor, portador):
- `PUT /contas-pagar-api/:id` ou `PATCH /contas-pagar-api/update`

### 5. Cancelamento/Estorno via API (push)
O `/cancelled` no export só permite o ERP puxar cancelamentos. Falta o inverso — o ERP notificar um cancelamento/estorno:
- `POST /contas-pagar-api/cancelar` com `{ id, motivo }`
- `POST /contas-pagar-api/estornar` com `{ id, motivo, valor_estorno }`

### 6. Anexos/Comprovantes
Sem API para enviar ou consultar comprovantes de pagamento:
- `POST /contas-pagar-api/anexos` (upload de comprovante)
- `GET /contas-pagar-api/anexos?conta_pagar_id=uuid`

## Plano de implementação

Tudo seria adicionado como novas sub-rotas dentro do `contas-pagar-api/index.ts` existente, mantendo a autenticação unificada.

### Prioridade 1 — Essencial para integração ERP
1. **GET /query** — Consulta avançada com filtros e paginação
2. **PUT /update** — Atualização individual de título
3. **POST /cancelar** — Cancelamento via API
4. **POST /registrar-pagamento** — Registrar pagamento/baixa via API

### Prioridade 2 — Dados complementares
5. **GET /parcelas** — Consulta de parcelas
6. **POST /parcelas/sync** — Sync de parcelas do ERP
7. **GET /pagamentos** — Histórico de pagamentos

### Prioridade 3 — Avançado
8. **POST /estornar** — Estorno de pagamento
9. **POST /anexos** + **GET /anexos** — Comprovantes

### Arquivos impactados
| Arquivo | Mudança |
|---|---|
| `supabase/functions/contas-pagar-api/index.ts` | +8 novas sub-rotas |
| `docs/API_CONTAS_PAGAR.md` | Documentação completa das novas rotas |

