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

## Endpoints

### 1. Listar Itens Aceitos Pendentes de Exportação (Provisão)

```
GET /contas-pagar-export-api/pending
```

Retorna itens com `financial_status = "accepted"` que ainda não foram exportados como `registration`.

**Query Parameters:**
| Parâmetro | Tipo | Default | Descrição |
|-----------|------|---------|-----------|
| `limit` | number | 100 | Máximo de registros |
| `offset` | number | 0 | Paginação |

**Exemplo:**
```bash
curl -H "x-api-key: SUA_CHAVE" \
  "https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/contas-pagar-export-api/pending"
```

**Resposta (Provisão):**
```json
{
  "data": [
    {
      "api_version": "1.0",
      "generated_at": "2026-03-10T14:30:00.000Z",
      "id": "uuid-do-pagamento",
      "empresa_id": 1,
      "export_type": "registration",
      "fornecedor": {
        "nome": "Fornecedor ABC Ltda",
        "documento": "12345678000190",
        "documento_formatado": "12.345.678/0001-90"
      },
      "documento": {
        "tipo": "NF",
        "numero": "12345"
      },
      "pagamento": {
        "valor": 1500.00,
        "moeda": "BRL",
        "data_vencimento": "2026-03-15",
        "portador": "Banco Itaú"
      },
      "departamento": "Compras",
      "descricao": "Compra de materiais",
      "status": "Aguardando Pagamento"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 100
}
```

### 2. Listar Pagamentos Pagos Pendentes de Exportação (Baixa)

```
GET /contas-pagar-export-api/paid
```

Retorna itens com `financial_status = "paid"` que ainda não foram exportados como `payment`.

**Resposta (Baixa):**
```json
{
  "data": [
    {
      "api_version": "1.0",
      "id": "uuid-do-pagamento",
      "export_type": "payment",
      "fornecedor": { "nome": "Fornecedor ABC Ltda", "documento": "12345678000190" },
      "pagamento": {
        "valor": 1500.00,
        "moeda": "BRL",
        "data_vencimento": "2026-03-15",
        "data_pagamento": "2026-03-10T14:30:00Z",
        "metodo": "PIX",
        "portador": "Banco Itaú"
      },
      "status": "Pago"
    }
  ]
}
```

### 3. Listar Todos os Pendentes (Aceitos + Pagos)

```
GET /contas-pagar-export-api
```

Ou com filtro:
```
GET /contas-pagar-export-api?status=accepted,paid
```

### 4. Confirmar Recebimento (marcar como exportado)

```
POST /contas-pagar-export-api/confirm
```

**Body:**
```json
{
  "ids": ["uuid-pagamento-1", "uuid-pagamento-2"],
  "export_type": "registration"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `ids` | string[] | Sim | IDs dos pagamentos |
| `export_type` | string | Não | `"registration"` ou `"payment"` (default: `"payment"`) |

**Resposta:**
```json
{
  "confirmed": 2,
  "export_type": "registration",
  "message": "2 item(ns) confirmado(s) como exportado(s) (registration)"
}
```

### 5. Status da Sincronização

```
GET /contas-pagar-export-api/status
```

**Resposta:**
```json
{
  "provisao": {
    "total_aceitos": 50,
    "exportados": 45,
    "pendentes": 5
  },
  "baixa": {
    "total_pagos": 30,
    "exportados": 28,
    "pendentes": 2
  },
  "resumo": {
    "total_pendentes_exportacao": 7
  }
}
```

---

## Fluxo Recomendado para o ERP

### Provisão (cadastro do título)
1. `GET /pending` — buscar itens aceitos
2. Cadastrar cada título no ERP como "A Pagar"
3. `POST /confirm` com `export_type: "registration"` — confirmar recebimento

### Baixa (pagamento)
1. `GET /paid` — buscar itens pagos
2. Baixar cada título no ERP
3. `POST /confirm` com `export_type: "payment"` — confirmar recebimento

### Monitoramento
- `GET /status` — visão geral de pendências

---

## Estrutura do Payload

### Campos Comuns (Provisão + Baixa)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `api_version` | string | Versão da API (`"1.0"`) |
| `generated_at` | ISO 8601 | Timestamp de geração |
| `id` | UUID | Identificador único do pagamento |
| `empresa_id` | number | ID da empresa |
| `export_type` | string | `"registration"` ou `"payment"` |
| `fornecedor.nome` | string | Nome do fornecedor |
| `fornecedor.documento` | string | CNPJ/CPF (apenas números) |
| `documento.tipo` | string | Tipo (NF, Boleto, etc.) |
| `documento.numero` | string | Número do documento |
| `departamento` | string | Departamento responsável |
| `descricao` | string | Descrição/observações |
| `status` | string | `"Aguardando Pagamento"` ou `"Pago"` |

### Campos de Pagamento (somente na Baixa)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `pagamento.data_pagamento` | ISO 8601 | Data/hora do pagamento |
| `pagamento.metodo` | string | Método (PIX, TED, Boleto, etc.) |

## Códigos de Erro

| Status | Descrição |
|--------|-----------|
| 401 | API key inválida ou ausente |
| 400 | Parâmetros inválidos |
| 404 | Rota não encontrada |
| 500 | Erro interno |
