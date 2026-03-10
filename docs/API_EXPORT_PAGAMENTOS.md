# API de Exportação de Pagamentos (Contas a Pagar)

API para o ERP consultar pagamentos confirmados e marcar como exportados.

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

## Endpoints

### 1. Listar Pagamentos Pagos (pendentes de exportação)

```
GET /contas-pagar-export-api/paid
```

**Query Parameters:**
| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `limit` | number | 100 | Máximo de registros |
| `offset` | number | 0 | Paginação |

**Exemplo:**
```bash
curl -H "x-api-key: SUA_CHAVE" \
  "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-export-api/paid?limit=50"
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "uuid-do-pagamento",
      "empresa_id": 1,
      "fornecedor_nome": "Fornecedor ABC Ltda",
      "fornecedor_documento": "12.345.678/0001-90",
      "tipo_documento": "NF",
      "numero_documento": "12345",
      "valor": 1500.00,
      "data_vencimento": "2026-03-15",
      "data_pagamento": "2026-03-10T14:30:00Z",
      "metodo_pagamento": "PIX",
      "portador": "Banco Itaú",
      "departamento": "Compras",
      "descricao": "Compra de materiais",
      "status": "Pago"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 100
}
```

### 2. Confirmar Recebimento (marcar como exportado)

```
POST /contas-pagar-export-api/confirm
```

**Body:**
```json
{
  "ids": ["uuid-pagamento-1", "uuid-pagamento-2"]
}
```

**Exemplo:**
```bash
curl -X POST \
  -H "x-api-key: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["uuid-1", "uuid-2"]}' \
  "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-export-api/confirm"
```

**Resposta:**
```json
{
  "confirmed": 2,
  "message": "2 pagamento(s) confirmado(s) como exportado(s)"
}
```

### 3. Status da Sincronização

```
GET /contas-pagar-export-api/status
```

**Resposta:**
```json
{
  "total_pagos": 150,
  "total_exportados": 130,
  "pendentes_exportacao": 20
}
```

---

## Fluxo Recomendado

1. **Consultar** pagamentos pendentes: `GET /paid`
2. **Processar** cada pagamento no ERP
3. **Confirmar** os IDs processados: `POST /confirm`
4. **Monitorar** via `GET /status`

## Campos do Payload

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único do pagamento |
| `empresa_id` | number | ID da empresa |
| `fornecedor_nome` | string | Nome do fornecedor |
| `fornecedor_documento` | string | CNPJ/CPF do fornecedor |
| `tipo_documento` | string | Tipo (NF, Boleto, etc.) |
| `numero_documento` | string | Número do documento |
| `valor` | number | Valor do pagamento |
| `data_vencimento` | date | Data de vencimento |
| `data_pagamento` | datetime | Data/hora do pagamento |
| `metodo_pagamento` | string | Método descritivo (PIX, TED, Boleto, etc.) |
| `portador` | string | Portador/banco |
| `departamento` | string | Departamento responsável |
| `descricao` | string | Descrição/observações |
| `status` | string | Sempre "Pago" |

## Códigos de Erro

| Status | Descrição |
|--------|-----------|
| 401 | API key inválida ou ausente |
| 400 | Parâmetros inválidos |
| 404 | Rota não encontrada |
| 500 | Erro interno |
