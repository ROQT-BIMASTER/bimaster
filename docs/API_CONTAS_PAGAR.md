# API Contas a Pagar — Documentação Completa v4.0.0

Base URL: `https://api.bimaster.online/v1/contas-pagar-api`

## Quick Start — 5 Minutos

```bash
# 1. Health check
curl -H "x-api-key: SUA_CHAVE" https://api.bimaster.online/v1/contas-pagar-api/status

# 2. Incluir título
curl -X POST https://api.bimaster.online/v1/contas-pagar-api/incluir \
  -H "x-api-key: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d '{ "codigo_lancamento_integracao": "NF-2026-001", "codigo_cliente_fornecedor": "uuid-fornecedor", "data_vencimento": "2026-04-30", "valor_documento": 1500, "codigo_categoria": "2.04.01" }'

# 3. Consultar pendentes (cursor pagination)
curl -H "x-api-key: SUA_CHAVE" "https://api.bimaster.online/v1/contas-pagar-api/query?status=pendente&limit=20"

# 4. Lançar pagamento
curl -X POST https://api.bimaster.online/v1/contas-pagar-api/lancar-pagamento \
  -H "x-api-key: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d '{ "codigo_lancamento_integracao": "NF-2026-001", "valor": 1500, "data": "15/04/2026" }'
```

---

## Quando usar cada método

| Cenário | Método | Descrição |
|---------|--------|-----------|
| Criar título novo | `cpIncluir` / `POST /incluir` | Retorna erro 409 se já existe |
| Criar ou atualizar | `cpUpsert` / `POST /upsert` | Idempotente. Requer `empresa_id`. Substitui o legado `/alterar` |
| Consultar / listar | `cpQuery` / `GET /query` | Paginação REST (limit/offset/cursor). Único método de listagem em v4.0.0 |
| Baixa por código integração | `cpLancarPagamento` / `POST /lancar-pagamento` | Identifica título por `codigo_lancamento_integracao`. Atômico + idempotente |
| Estorno auditável | `cpEstornar` / `POST /estornar` | Estorno parcial/total com motivo obrigatório. Substitui o legado `/cancelar-pagamento` |

## Formato de Datas

- **Entrada**: Aceita `DD/MM/AAAA` ou `YYYY-MM-DD`
- **Saída**: Sempre retorna `YYYY-MM-DD` (ISO 8601)

---

## Changelog

| Versão | Data | Alterações |
|--------|------|------------|
| 4.0.0 | 2026-04-17 | **BREAKING**: removidos `/listar`, `/alterar`, `/registrar-pagamento`, `/cancelar-pagamento`. Use `/query`, `/upsert`, `/lancar-pagamento`, `/estornar` |
| 2.4.0 | 2026-04 | Idempotência, transações atômicas, rate limiting global, cursor pagination, envelope unificado |
| 2.3.0 | 2026-03 | Validação Zod completa, health check enriquecido |
| 2.0.0 | 2026-02 | Endpoints de integração Huggs |

---

## Autenticação

Todas as requisições exigem **API Key** ou **JWT**:
- `x-api-key: SUA_CHAVE` (ERP/server-to-server)
- `Authorization: Bearer <token>` (usuários autenticados)

---

## Rate Limiting

| Método de Auth | Limite | Janela |
|----------------|--------|--------|
| API Key | 120 req/min | Por chave |
| JWT | 60 req/min | Por usuário |

Ao exceder o limite, a API retorna `429 Too Many Requests` com header `Retry-After: 60`.

---

## Idempotência

Endpoints mutantes (POST/PUT) suportam o header `X-Idempotency-Key` para evitar duplicatas em retentativas de rede.

### Como funciona

1. O cliente envia um UUID único no header `X-Idempotency-Key`
2. Se a key já foi processada, a API retorna a resposta original (cache de 24h) com header `X-Idempotency-Replayed: true`
3. Se a key é nova, processa normalmente e armazena a resposta

### Endpoints com suporte

| Endpoint | Uso recomendado |
|----------|-----------------|
| `POST /incluir` | Sempre |
| `POST /upsert` | Sempre |
| `POST /upsert-lote` | Sempre |
| `POST /lancar-pagamento` | **Obrigatório** — evita pagamentos duplicados |
| `POST /estornar` | Recomendado |

### Exemplo

```bash
curl -X POST https://api.bimaster.online/v1/contas-pagar-api/incluir \
  -H "x-api-key: SUA_CHAVE" \
  -H "X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{ "codigo_lancamento_integracao": "INT-001", "valor_documento": 100 }'
```

**Resposta (replay):**
```
HTTP/1.1 200 OK
X-Idempotency-Replayed: true
```

---

## Envelope de Resposta

Todas as respostas incluem o objeto `meta`:

```json
{
  "data": { ... },
  "meta": {
    "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "api_version": "4.0.0",
    "processed_at": "2026-04-17T12:00:00.000Z",
    "duration_ms": 45
  }
}
```

Headers de resposta:
- `X-Request-Id`: UUID da requisição (igual ao `meta.request_id`)
- `X-API-Version`: Versão da API

---

## Paginação

### Cursor (recomendado)

Disponível em `/query` e `/pagamentos`. Use o `id` do último registro como cursor:

```
GET /query?limit=100&cursor=uuid-do-ultimo-registro
```

### Offset (alternativa)

```
GET /query?limit=50&offset=100
```

Vantagens do cursor: performance constante independente do offset, sem registros pulados em inserções concorrentes.

---

## Rotas de Integração

### GET /consultar — Consultar título

```
GET /contas-pagar-api/consultar?codigo_lancamento_integracao=INT-001
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `id` | UUID | ID interno |
| `codigo_lancamento_integracao` | string | Código de integração |
| `codigo_lancamento_huggs` | integer | Código numérico Huggs |

### POST /incluir — Incluir título (IncluirContaPagar)

```json
{
  "codigo_lancamento_integracao": "INT-001",
  "codigo_cliente_fornecedor": 4214850,
  "data_vencimento": "21/03/2026",
  "valor_documento": 100,
  "codigo_categoria": "2.04.01",
  "data_previsao": "21/03/2026",
  "id_conta_corrente": 4243124
}
```

**Resposta:**
```json
{
  "codigo_lancamento_huggs": null,
  "codigo_lancamento_integracao": "INT-001",
  "codigo_status": "0",
  "descricao_status": "Cadastro incluído com sucesso!",
  "meta": {
    "request_id": "uuid",
    "api_version": "4.0.0",
    "duration_ms": 120
  }
}
```

### DELETE /excluir — Excluir título (ExcluirContaPagar)

```
DELETE /contas-pagar-api/excluir?codigo_lancamento_integracao=INT-001
```

### POST /upsert — Upsert unitário (UpsertContaPagar)

Substitui o legado `PUT /alterar` removido em v4.0.0. Use sempre `/upsert` para criar ou atualizar idempotentemente.

```json
{
  "codigo_lancamento_integracao": "INT-001",
  "empresa_id": 8,
  "codigo_cliente_fornecedor": 4214850,
  "data_vencimento": "21/03/2026",
  "valor_documento": 100,
  "codigo_categoria": "2.04.01"
}
```

### POST /upsert-lote — Upsert em lote (UpsertContaPagarPorLote)

```json
{
  "lote": 1,
  "conta_pagar_cadastro": [
    { "codigo_lancamento_integracao": "INT-001", "empresa_id": 8, "valor_documento": 100 }
  ]
}
```

Máximo: **500 registros por lote**.

### POST /lancar-pagamento — Baixa (LancarPagamento)

> **Transação atômica**: INSERT em `pagamentos` + UPDATE em `contas_pagar` executados em uma única transação via RPC `process_payment_atomic`.

```json
{
  "codigo_lancamento_integracao": "INT-001",
  "valor": 100.20,
  "desconto": 0,
  "juros": 0,
  "multa": 0,
  "data": "21/03/2026",
  "observacao": "Baixa via API"
}
```

**Resposta:**
```json
{
  "codigo_lancamento_integracao": "INT-001",
  "codigo_baixa": "uuid",
  "liquidado": "S",
  "valor_baixado": 100.20,
  "codigo_status": "0",
  "descricao_status": "Pagamento registrado com sucesso!",
  "meta": { "request_id": "uuid", "api_version": "4.0.0", "duration_ms": 85 }
}
```

---

## Endpoints Legados (Sync & CRUD)

### Endpoints de Sync (ERP → BiMaster)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/sync` | Sync legado (compatibilidade N8N) |
| POST | `/bulk-sync` | Sync em massa com rate limiting |
| POST | `/sync-incremental` | Sync incremental com hash |
| POST | `/sync-complete` | Finalizar sync multi-chunk |
| POST | `/trigger-n8n` | Disparar sync via webhook N8N |
| GET | `/chunks-progress` | Progresso de sync multi-chunk |

### Endpoints de Consulta

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Listar últimos 100 títulos |
| GET | `/query` | Consulta avançada com filtros e cursor |
| GET | `/status` | Health check enriquecido |
| GET | `/stats` | Estatísticas de sync |
| GET | `/last-sync` | Última data de sync |
| GET | `/parcelas` | Parcelas de um título |
| GET | `/pagamentos` | Histórico de pagamentos (com cursor) |
| GET | `/anexos` | Comprovantes de um título |

### GET /query — Consulta avançada

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `empresa_id` | string | — | Filtro por empresa |
| `fornecedor_codigo` | string | — | Código do fornecedor |
| `status` | string | — | Status (vírgula para múltiplos) |
| `vencimento_de` | date | — | Vencimento inicial (YYYY-MM-DD) |
| `vencimento_ate` | date | — | Vencimento final (YYYY-MM-DD) |
| `emissao_de` | date | — | Emissão inicial (YYYY-MM-DD) |
| `emissao_ate` | date | — | Emissão final (YYYY-MM-DD) |
| `limit` | integer | 100 | Máx registros (1-1000) |
| `offset` | integer | 0 | Paginação offset |
| `cursor` | uuid | — | ID para cursor pagination |
| `order_by` | string | data_vencimento | Campo de ordenação |
| `order_dir` | string | — | `asc` ou `desc` |

### GET /pagamentos — Histórico de pagamentos

| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `conta_pagar_id` | uuid | — | ID do título |
| `limit` | integer | 100 | Máx registros (1-500) |
| `offset` | integer | 0 | Paginação offset |
| `cursor` | uuid | — | ID para cursor pagination |

### Endpoints de Escrita

| Método | Rota | Descrição |
|--------|------|-----------|
| PUT | `/update` | Atualizar título |
| POST | `/cancelar` | Cancelar título(s) |
| POST | `/estornar` | Estornar pagamento (auditável com motivo) |
| POST | `/parcelas/sync` | Sync parcelas do ERP |
| POST | `/anexos` | Registrar comprovante |

### POST /estornar — Estornar pagamento

Substitui o legado `POST /cancelar-pagamento` removido em v4.0.0. Estorno parcial ou total com motivo auditável obrigatório.

```json
{
  "id": "uuid-titulo",
  "motivo": "Pagamento indevido",
  "valor_estorno": 500
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | uuid | Sim | ID do título |
| `motivo` | string | Sim | Motivo do estorno (1-500 chars) |
| `valor_estorno` | number | Não | Valor parcial (default: total) |

---

## GET /status — Health Check Enriquecido

```json
{
  "status": "online",
  "version": "4.0.0",
  "timestamp": "2026-04-17T12:00:00.000Z",
  "service": "contas-pagar-api",
  "health": {
    "db_latency_ms": 12,
    "db_connected": true,
    "active_sync_slots": 3
  },
  "meta": {
    "request_id": "uuid",
    "api_version": "4.0.0",
    "duration_ms": 15
  }
}
```

---

## Campos Tributários (Impostos Retidos)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `valor_pis` | decimal | Valor do PIS |
| `retem_pis` | boolean | Reter PIS |
| `valor_cofins` | decimal | Valor do COFINS |
| `retem_cofins` | boolean | Reter COFINS |
| `valor_csll` | decimal | Valor CSLL |
| `retem_csll` | boolean | Reter CSLL |
| `valor_ir` | decimal | Valor IR |
| `retem_ir` | boolean | Reter IR |
| `valor_iss` | decimal | Valor ISS |
| `retem_iss` | boolean | Reter ISS |
| `valor_inss` | decimal | Valor INSS |
| `retem_inss` | boolean | Reter INSS |

## Campos CNAB / Bancário

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `codigo_barras_ficha_compensacao` | string(70) | Código de barras do boleto |
| `cnab_dados` | JSONB | Dados CNAB (forma_pagamento, banco_transferencia, pix_qrcode) |

## Rateios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `rateio_categorias` | JSONB | Array de rateio por categorias |
| `rateio_departamentos` | JSONB | Array de rateio por departamentos |
| `servico_tomado` | JSONB | Dados do serviço tomado (NF, CST, alíquotas) |

---

## Mapa Completo de Rotas

| Método | Rota | Auth | Idempotência | Descrição |
|--------|------|------|--------------|-----------|
| GET | `/` | JWT/Key | — | Listar últimos 100 títulos |
| GET | `/query` | JWT/Key | — | Consulta avançada (cursor + offset) |
| GET | `/consultar` | JWT/Key | — | Consultar por ID/código integração |
| GET | `/status` | — | — | Health check enriquecido |
| GET | `/stats` | JWT/Key | — | Estatísticas de sync |
| GET | `/last-sync` | Key | — | Última data de sync |
| GET | `/parcelas` | JWT/Key | — | Parcelas de um título |
| GET | `/pagamentos` | JWT/Key | — | Histórico de pagamentos (cursor) |
| GET | `/anexos` | JWT/Key | — | Comprovantes de um título |
| GET | `/chunks-progress` | Key | — | Progresso sync multi-chunk |
| POST | `/sync` | Key | — | Sync legado |
| POST | `/bulk-sync` | Key | — | Sync em massa |
| POST | `/sync-incremental` | Key | — | Sync incremental |
| POST | `/sync-complete` | Key | — | Finalizar sync |
| POST | `/trigger-n8n` | JWT/Key | — | Disparar N8N |
| POST | `/incluir` | JWT/Key | Sim | Incluir título |
| POST | `/upsert` | JWT/Key | Sim | Upsert unitário (substitui /alterar) |
| POST | `/upsert-lote` | JWT/Key | Sim | Upsert em lote |
| POST | `/lancar-pagamento` | JWT/Key | **Obrigatório** | Baixa Integração (atômica) |
| POST | `/cancelar` | JWT/Key | — | Cancelar título |
| POST | `/estornar` | JWT/Key | Sim | Estornar pagamento (substitui /cancelar-pagamento) |
| POST | `/parcelas/sync` | Key | — | Sync parcelas |
| POST | `/anexos` | JWT/Key | — | Registrar comprovante |
| PUT | `/update` | JWT/Key | — | Atualizar título |
| DELETE | `/excluir` | JWT/Key | — | Excluir título |

---

## Códigos de Erro

| HTTP | Código | Descrição |
|------|--------|-----------|
| 400 | `validation_error` | Parâmetros inválidos (Zod) |
| 401 | `unauthorized` | API key/JWT inválido |
| 403 | `forbidden` | Sem permissão |
| 404 | `not_found` | Recurso não encontrado |
| 409 | `conflict` | Registro duplicado |
| 429 | `rate_limit_exceeded` | Rate limit excedido |
| 500 | `internal_error` | Erro interno |
