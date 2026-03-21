

# Contas a Pagar — APIs faltantes para cobertura completa de envio ao ERP

## Análise do que já existe

| Componente | Cobertura |
|---|---|
| `contas-pagar-api` | 21 rotas (sync inbound, CRUD, query, parcelas, pagamentos, estorno, anexos) |
| `contas-pagar-export-api` | Pull: GET /pending, /paid, /cancelled, POST /confirm, GET /status |
| `erp-export-payment` | Push individual: export, retry, status (só JWT, via UI) |
| `erp-webhook-inbound` | Callbacks: provisao_registrada, baixa_confirmada, estorno_processado, erro_processamento |

## O que falta (6 endpoints novos)

### 1. GET /export-history — Histórico de exportações
**Problema**: Não existe forma de consultar o histórico completo de exportações (erp_export_queue) via API. O ERP não consegue auditar o que já foi enviado.

**Rota**: `GET /contas-pagar-export-api/history?empresa_id=8&export_type=payment&status=exported&limit=50`

### 2. POST /export-batch — Exportação em lote
**Problema**: O `erp-export-payment` só exporta 1 item por vez (via UI/JWT). O ERP precisa disparar exportação em batch via API key.

**Rota**: `POST /contas-pagar-export-api/export-batch`
```json
{ "ids": ["uuid-1", "uuid-2"], "channel": "rest_api", "export_type": "payment" }
```

### 3. GET /reconciliation — Reconciliação BiMaster ↔ ERP
**Problema**: Sem forma de comparar o estado dos títulos no BiMaster com o que o ERP já recebeu. Fundamental para detectar divergências.

**Rota**: `GET /contas-pagar-export-api/reconciliation?empresa_id=8`

Retorna: títulos exportados vs não exportados, com contagem por status.

### 4. POST /retry-failed — Reprocessar exportações com erro
**Problema**: O retry no `erp-export-payment` só funciona 1 a 1 via JWT. Não tem retry em batch via API key.

**Rota**: `POST /contas-pagar-export-api/retry-failed`
```json
{ "ids": ["export-queue-id-1"], "channel": "rest_api" }
```
Ou sem ids: reprocessa todos com `export_status = 'error'`.

### 5. POST /webhook-push — Push automático para ERP (webhook outbound)
**Problema**: Hoje o ERP precisa fazer polling (GET /pending, GET /paid). Falta um push proativo que notifica o ERP quando um título muda de status.

**Rota**: `POST /contas-pagar-export-api/webhook-push`
```json
{ "webhook_url": "https://erp.empresa.com/api/webhook", "events": ["accepted", "paid", "cancelled"] }
```
Registra configuração de webhook. Quando houver novos itens, o sistema envia automaticamente.

### 6. GET /export-summary — Resumo detalhado por empresa
**Problema**: O GET /status atual é global. Falta resumo por empresa e por período.

**Rota**: `GET /contas-pagar-export-api/export-summary?empresa_id=8&periodo_de=2026-01-01&periodo_ate=2026-03-31`

---

## Plano de implementação

Tudo será **adicionado** ao `contas-pagar-export-api/index.ts` existente, sem modificar nenhuma rota atual.

### Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/contas-pagar-export-api/index.ts` | +6 novas rotas (adicionadas após as existentes) |
| `docs/API_EXPORT_PAGAMENTOS.md` | Documentação das novas rotas |

### Ordem de implementação
1. GET /export-history (auditoria)
2. POST /export-batch (lote)
3. POST /retry-failed (reprocessamento)
4. GET /reconciliation (divergências)
5. GET /export-summary (métricas por empresa)
6. POST /webhook-push (configuração de push)

### Detalhes técnicos

- Todas as novas rotas usam autenticação via `x-api-key` (mesmo padrão das existentes)
- Rate limiting via `checkRateLimit` já implementado no arquivo
- Respostas incluem `meta: { duration_ms, processed_at }`
- CORS e security headers mantidos
- Nenhuma rota existente será alterada

