# API Contas a Pagar — Documentação Completa

Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-api`

## Autenticação

Todas as requisições exigem **API Key** ou **JWT**:
- `x-api-key: SUA_CHAVE` (ERP/server-to-server)
- `Authorization: Bearer <token>` (usuários autenticados)

---

## Endpoints de Sync (ERP → BiMaster)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/sync` | Sync legado (compatibilidade N8N) |
| POST | `/bulk-sync` | Sync em massa com rate limiting |
| POST | `/sync-incremental` | Sync incremental com hash |
| POST | `/sync-complete` | Finalizar sync multi-chunk |
| POST | `/trigger-n8n` | Disparar sync via webhook N8N |

---

## Endpoints de Consulta

### GET /query — Consulta avançada com filtros

```
GET /contas-pagar-api/query?empresa_id=8&status=pendente,vencido&vencimento_de=2026-01-01&limit=500
```

**Query Parameters:**
| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `empresa_id` | string | — | Filtrar por empresa |
| `fornecedor_codigo` | string | — | Código do fornecedor |
| `status` | string | — | Status (vírgula para múltiplos: `pendente,vencido`) |
| `vencimento_de` | date | — | Vencimento a partir de (YYYY-MM-DD) |
| `vencimento_ate` | date | — | Vencimento até (YYYY-MM-DD) |
| `emissao_de` | date | — | Emissão a partir de |
| `emissao_ate` | date | — | Emissão até |
| `limit` | number | 100 | Máx registros (teto: 1000) |
| `offset` | number | 0 | Paginação |
| `order_by` | string | `data_vencimento` | Campo de ordenação |
| `order_dir` | string | `desc` | `asc` ou `desc` |

**Resposta:**
```json
{
  "data": [...],
  "pagination": { "total": 1500, "limit": 100, "offset": 0, "has_more": true },
  "meta": { "duration_ms": 45, "processed_at": "2026-03-21T..." }
}
```

### GET /parcelas — Parcelas de um título

```
GET /contas-pagar-api/parcelas?conta_pagar_id=uuid&limit=100&offset=0
```

### GET /pagamentos — Histórico de pagamentos

```
GET /contas-pagar-api/pagamentos?conta_pagar_id=uuid
```

### GET /anexos — Comprovantes de um título

```
GET /contas-pagar-api/anexos?conta_pagar_id=uuid
```

---

## Endpoints de Escrita

### PUT /update — Atualizar título

```bash
curl -X PUT -H "x-api-key: KEY" -H "Content-Type: application/json" \
  -d '{"id": "uuid", "data_vencimento": "2026-04-15", "portador": "Banco Itaú"}' \
  .../contas-pagar-api/update
```

**Campos permitidos:** `valor_original`, `valor_aberto`, `valor_pago`, `valor_juros`, `valor_desconto`, `valor_ajustes`, `data_vencimento`, `data_pagamento`, `portador`, `conta`, `categoria_codigo`, `categoria_nome`, `status`, `observacao`, `numero_documento`, `tipo_documento`

**Resposta:**
```json
{
  "success": true,
  "data": { "id": "uuid", ... },
  "meta": { "duration_ms": 30 }
}
```

### POST /cancelar — Cancelar título(s)

```json
POST /contas-pagar-api/cancelar
{
  "ids": ["uuid-1", "uuid-2"],
  "motivo": "Duplicidade de lançamento"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | string | Sim* | ID único (ou use `ids`) |
| `ids` | string[] | Sim* | IDs múltiplos |
| `motivo` | string | Sim | Justificativa obrigatória |

### POST /registrar-pagamento — Baixa via API

```json
POST /contas-pagar-api/registrar-pagamento
{
  "conta_pagar_id": "uuid",
  "valor_pago": 1500.00,
  "data_pagamento": "2026-03-21",
  "metodo_pagamento": "PIX",
  "observacao": "Pagamento via ERP"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `conta_pagar_id` | UUID | Sim | ID do título |
| `valor_pago` | number | Sim | Valor pago |
| `data_pagamento` | date | Não | Default: hoje |
| `metodo_pagamento` | string | Não | PIX, TED, Boleto... |
| `observacao` | string | Não | Notas |

**Comportamento:** Insere em `pagamentos`, atualiza `valor_pago`/`valor_aberto`/`status` no título. Se `valor_aberto <= 0`, status → `pago`.

### POST /estornar — Estorno de pagamento

```json
POST /contas-pagar-api/estornar
{
  "id": "uuid-conta-pagar",
  "motivo": "Pagamento devolvido pelo banco",
  "valor_estorno": 500.00
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | UUID | Sim | ID do título |
| `motivo` | string | Sim | Justificativa |
| `valor_estorno` | number | Não | Default: valor total pago |

### POST /parcelas/sync — Sync parcelas do ERP

```json
POST /contas-pagar-api/parcelas/sync
{
  "parcelas": [
    { "conta_pagar_id": "uuid", "numero_parcela": 1, "valor": 500, "data_vencimento": "2026-04-01" },
    { "conta_pagar_id": "uuid", "numero_parcela": 2, "valor": 500, "data_vencimento": "2026-05-01" }
  ]
}
```

Máximo: **5000 parcelas por request**.

### POST /anexos — Registrar comprovante

```json
POST /contas-pagar-api/anexos
{
  "conta_pagar_id": "uuid",
  "nome_arquivo": "comprovante_pix.pdf",
  "tipo": "application/pdf",
  "url": "https://storage.../comprovante.pdf",
  "observacao": "Comprovante PIX"
}
```

---

## Códigos de Erro

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `campo_obrigatorio` | Campo obrigatório ausente |
| 400 | `sem_alteracoes` | Nenhum campo válido no update |
| 400 | `payload_invalido` | Payload não é array válido |
| 400 | `titulo_cancelado` | Operação bloqueada em título cancelado |
| 400 | `status_invalido` | Status não permite a operação |
| 401 | `Unauthorized` | API key ou JWT inválido |
| 404 | `nao_encontrado` | Título não encontrado |
| 413 | `payload_excedido` | Array excede limite máximo |
| 429 | — | Rate limit excedido |
| 500 | — | Erro interno |

---

## Mapa Completo de Rotas

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/` | JWT/Key | Listar últimos 100 títulos |
| GET | `/query` | JWT/Key | Consulta avançada com filtros |
| GET | `/status` | Key | Status da API |
| GET | `/stats` | JWT/Key | Estatísticas de sync |
| GET | `/last-sync` | Key | Última data de sync |
| GET | `/chunks-progress` | JWT/Key | Progresso de chunks |
| GET | `/parcelas` | JWT/Key | Parcelas de um título |
| GET | `/pagamentos` | JWT/Key | Histórico de pagamentos |
| GET | `/anexos` | JWT/Key | Comprovantes de um título |
| POST | `/sync` | Key | Sync legado |
| POST | `/bulk-sync` | Key | Sync em massa |
| POST | `/sync-incremental` | Key | Sync incremental |
| POST | `/sync-complete` | Key | Finalizar sync |
| POST | `/trigger-n8n` | JWT/Key | Disparar N8N |
| POST | `/debug-payload` | Key | Debug de payload |
| POST | `/registrar-pagamento` | JWT/Key | Registrar baixa |
| POST | `/cancelar` | JWT/Key | Cancelar título |
| POST | `/estornar` | JWT/Key | Estornar pagamento |
| POST | `/parcelas/sync` | Key | Sync parcelas |
| POST | `/anexos` | JWT/Key | Registrar comprovante |
| PUT | `/update` | JWT/Key | Atualizar título |
