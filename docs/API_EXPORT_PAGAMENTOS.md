# API de Exportação de Pagamentos (Contas a Pagar)

API para o ERP consultar pagamentos e marcar como exportados. Segue o padrão profissional de **provisão contábil** (ao aceitar) e **baixa financeira** (ao pagar).

## Autenticação

Todas as requisições devem incluir o header `x-api-key`:

```
x-api-key: SUA_CHAVE_API
```

## Base URL

```
https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-export-api
```

---

## Fluxo Profissional (Padrão SAP/TOTVS)

```text
Lançamento → Aprovação Financeira → ERP: "Aguardando Pagamento" (provisão)
                                          ↓
             Pagamento Efetuado    → ERP: "Pago" (baixa do título)
```

O ERP recebe **dois eventos** por título:
1. **Registration** — provisão ao aceitar (dados do fornecedor, documento, valor, vencimento)
2. **Payment** — baixa ao pagar (método de pagamento, data de pagamento)

---

## Endpoints — Pull (Consulta)

### 1. GET /pending — Itens Aceitos Pendentes (Provisão)

Retorna itens com `financial_status = "accepted"` que ainda não foram exportados como `registration`.

**Query Parameters:**
| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `limit` | number | 100 | Máximo de registros |
| `offset` | number | 0 | Paginação |

```bash
curl -H "x-api-key: SUA_CHAVE" \
  "BASE_URL/pending"
```

**Resposta:**
```json
{
  "data": [{
    "api_version": "1.0",
    "id": "uuid",
    "empresa_id": 1,
    "export_type": "registration",
    "fornecedor": { "nome": "Fornecedor ABC", "documento": "12345678000190" },
    "pagamento": { "valor": 1500.00, "moeda": "BRL", "data_vencimento": "2026-03-15" },
    "status": "Aguardando Pagamento"
  }],
  "total": 1
}
```

### 2. GET /paid — Pagamentos Pendentes de Exportação (Baixa)

Retorna itens com `financial_status = "paid"` não exportados como `payment`.

### 3. GET /cancelled — Títulos Cancelados Pendentes

Retorna títulos da tabela `contas_pagar` com `status = "cancelado"` não exportados como `cancellation`.

### 4. GET / — Todos os Pendentes

Retorna aceitos + pagos. Filtrar com `?status=accepted,paid,cancelado`.

---

## Endpoints — Confirmação

### 5. POST /confirm — Confirmar Recebimento

```json
{ "ids": ["uuid-1", "uuid-2"], "export_type": "registration" }
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `ids` | string[] | Sim | IDs dos pagamentos |
| `export_type` | string | Não | `"registration"`, `"payment"` ou `"cancellation"` |

---

## Endpoints — Monitoramento

### 6. GET /status — Status da Sincronização

```json
{
  "provisao": { "total_aceitos": 50, "exportados": 45, "pendentes": 5 },
  "baixa": { "total_pagos": 30, "exportados": 28, "pendentes": 2 },
  "resumo": { "total_pendentes_exportacao": 7 }
}
```

### 7. GET /history — Histórico de Exportações *(NOVO)*

Consulta completa do `erp_export_queue` com filtros.

**Query Parameters:**
| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `export_type` | string | — | Filtro: `registration`, `payment`, `cancellation` |
| `status` | string | — | Filtro: `exported`, `pending`, `error` |
| `limit` | number | 100 | Máximo 500 |
| `offset` | number | 0 | Paginação |

```bash
curl -H "x-api-key: SUA_CHAVE" \
  "BASE_URL/history?export_type=payment&status=exported&limit=50"
```

**Resposta:**
```json
{
  "data": [{
    "id": "uuid-queue",
    "payment_queue_id": "uuid-pagamento",
    "export_type": "payment",
    "export_status": "exported",
    "export_channel": "rest_api",
    "exported_at": "2026-03-10T14:30:00Z",
    "created_at": "2026-03-10T10:00:00Z"
  }],
  "total": 150,
  "offset": 0,
  "limit": 50,
  "meta": { "duration_ms": 45, "processed_at": "2026-03-21T..." }
}
```

### 8. GET /reconciliation — Reconciliação BiMaster ↔ ERP *(NOVO)*

Compara títulos no BiMaster com exportações confirmadas para detectar divergências.

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `empresa_id` | number | Filtro por empresa (opcional) |

```bash
curl -H "x-api-key: SUA_CHAVE" \
  "BASE_URL/reconciliation?empresa_id=8"
```

**Resposta:**
```json
{
  "empresa_id": "8",
  "resumo": {
    "total_titulos": 500,
    "exportados": 480,
    "com_erro": 5,
    "pendentes_envio": 3,
    "nao_enviados": 12,
    "taxa_sincronizacao": 96.00
  },
  "por_status": {
    "pendente": { "total": 100, "exported": 95, "pending_export": 2, "error": 1, "not_sent": 2 },
    "pago": { "total": 300, "exported": 298, "pending_export": 1, "error": 1, "not_sent": 0 }
  }
}
```

### 9. GET /export-summary — Resumo Detalhado por Empresa *(NOVO)*

Métricas agregadas de exportação filtradas por empresa e período.

**Query Parameters:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `empresa_id` | number | Filtro por empresa |
| `periodo_de` | date | Data inicial (YYYY-MM-DD) |
| `periodo_ate` | date | Data final (YYYY-MM-DD) |

```bash
curl -H "x-api-key: SUA_CHAVE" \
  "BASE_URL/export-summary?empresa_id=8&periodo_de=2026-01-01&periodo_ate=2026-03-31"
```

**Resposta:**
```json
{
  "empresa_id": "8",
  "periodo": { "de": "2026-01-01", "ate": "2026-03-31" },
  "resumo": { "total_registros": 200, "exportados": 180, "pendentes": 10, "com_erro": 10 },
  "por_tipo": {
    "registration": { "exported": 95, "pending": 3, "error": 2 },
    "payment": { "exported": 85, "pending": 7, "error": 8 }
  },
  "por_canal": { "rest_api": 120, "pull_api": 60, "n8n": 20 }
}
```

---

## Endpoints — Ações em Lote

### 10. POST /export-batch — Exportação em Lote *(NOVO)*

Enfileira múltiplos itens para exportação em uma única chamada.

**Body:**
```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"],
  "channel": "rest_api",
  "export_type": "payment"
}
```

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|-------------|---------|-----------|
| `ids` | string[] | Sim | — | IDs dos pagamentos (máx 200) |
| `channel` | string | Não | `rest_api` | Canal: `rest_api`, `n8n`, `sql_direct` |
| `export_type` | string | Não | `payment` | `registration` ou `payment` |

**Resposta:**
```json
{
  "queued": 3,
  "skipped": 0,
  "export_type": "payment",
  "channel": "rest_api",
  "message": "3 item(ns) enfileirado(s) para exportação, 0 já exportado(s)"
}
```

### 11. POST /retry-failed — Reprocessar Exportações com Erro *(NOVO)*

Reenfileira itens com `export_status = 'error'` para reprocessamento.

**Body:**
```json
{
  "ids": ["queue-uuid-1"],
  "channel": "rest_api"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `ids` | string[] | Não | IDs da fila (se omitido, reprocessa todos com erro) |
| `channel` | string | Não | Canal para reprocessamento (default: `rest_api`) |

**Resposta:**
```json
{
  "retried": 5,
  "total_errors_found": 5,
  "message": "5 item(ns) reenfileirado(s) para reprocessamento"
}
```

---

## Endpoints — Webhook Outbound

### 12. POST /webhook-push — Configurar Push Automático *(NOVO)*

Registra um webhook para receber notificações automáticas quando títulos mudam de status.

**Body:**
```json
{
  "webhook_url": "https://erp.empresa.com/api/webhook",
  "events": ["accepted", "paid", "cancelled"],
  "secret": "meu-hmac-secret",
  "empresa_id": 8
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `webhook_url` | string | Sim | URL HTTPS do endpoint ERP |
| `events` | string[] | Sim | Eventos: `accepted`, `paid`, `cancelled`, `registration`, `payment`, `cancellation` |
| `secret` | string | Não | Secret para assinatura HMAC dos payloads |
| `empresa_id` | number | Não | Empresa (default: 1) |

**Resposta:**
```json
{
  "message": "Webhook configurado com sucesso",
  "webhook_url": "https://erp.empresa.com/api/webhook",
  "events": ["accepted", "paid", "cancelled"],
  "empresa_id": 8
}
```

---

## Fluxo Recomendado para o ERP

### Provisão (cadastro do título)
1. `GET /pending` — buscar itens aceitos
2. Cadastrar cada título no ERP como "A Pagar"
3. `POST /confirm` com `export_type: "registration"`

### Baixa (pagamento)
1. `GET /paid` — buscar itens pagos
2. Baixar cada título no ERP
3. `POST /confirm` com `export_type: "payment"`

### Exportação em Lote
1. `POST /export-batch` — enfileirar múltiplos itens
2. Processar fila no ERP
3. `POST /confirm` — confirmar recebimento

### Monitoramento
- `GET /status` — visão geral rápida
- `GET /export-summary` — métricas detalhadas por empresa/período
- `GET /reconciliation` — detectar divergências
- `GET /history` — auditoria completa

### Tratamento de Erros
1. `POST /retry-failed` — reprocessar falhas automaticamente
2. `GET /history?status=error` — investigar erros específicos

---

## Códigos de Erro

| Status | Descrição |
|--------|-----------|
| 401 | API key inválida ou ausente |
| 400 | Parâmetros inválidos |
| 404 | Rota não encontrada |
| 429 | Rate limit excedido (60 req/min) |
| 500 | Erro interno |
