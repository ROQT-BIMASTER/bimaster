# API Boletos (Cobrança Bancária)

API para gestão de boletos bancários vinculados a títulos do Contas a Receber, seguindo o padrão Huggs.

> ⚠️ **ATENÇÃO**: Boletos gerados e já enviados ao banco estão sujeitos a tarifação (emissão, cancelamento ou alteração de vencimento).

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/boletos-api`

## Autenticação

- **API Key**: Header `x-api-key` com chave válida
- **JWT**: Header `Authorization: Bearer <token>`

---

## Endpoints

### POST `/gerar` — GerarBoleto

Gera um boleto para um título do Contas a Receber.

**Request:**
```json
{
  "nCodTitulo": 12345,
  "cCodIntTitulo": "CR-001",
  "nPerJuros": 2.0,
  "nPerMulta": 2.0,
  "dDescontoCond1": "2026-03-25",
  "vDescontoCond1": 5.00
}
```

**Response (201):**
```json
{
  "cLinkBoleto": "https://boleto.exemplo.com/...",
  "cCodStatus": "0",
  "cDesStatus": "Boleto gerado com sucesso!",
  "dDtEmBol": "2026-03-21",
  "cNumBoleto": "BOL-1711036800000",
  "cCodBarras": "23793...",
  "nPerJuros": 2.0,
  "nPerMulta": 2.0,
  "cNumBancario": "109876",
  "dDescontoCond1": "2026-03-25",
  "vDescontoCond1": 5.00
}
```

### GET `/obter` — ObterBoleto

Obtém link e dados de um boleto.

**Parâmetros query:**
| Param | Tipo | Descrição |
|---|---|---|
| `nCodTitulo` | integer | Código do título no Huggs |
| `cCodIntTitulo` | string | Código de integração |
| `id` | uuid | ID interno do boleto |

### POST `/cancelar` — CancelarBoleto

Cancela um boleto gerado.

**Request:**
```json
{
  "nCodTitulo": 12345,
  "cCodIntTitulo": "CR-001"
}
```

**Response:**
```json
{
  "cCodStatus": "0",
  "cDesStatus": "Boleto cancelado com sucesso!"
}
```

### POST `/prorrogar` — ProrrogarBoleto

Prorroga o vencimento de um boleto.

**Request:**
```json
{
  "nCodTitulo": 12345,
  "cCodIntTitulo": "CR-001",
  "dDtVenc": "30/04/2026"
}
```

**Response:** Mesma estrutura do GerarBoleto com dados atualizados.

### GET `/listar`

Lista boletos com paginação.

**Parâmetros query:**
| Param | Tipo | Descrição |
|---|---|---|
| `pagina` | integer | Página (default: 1) |
| `registros_por_pagina` | integer | Registros por página (máx 500) |
| `status` | string | Filtro: gerado, cancelado, prorrogado |

### GET `/status`

Health check da API (sem autenticação).

---

## Tipos Complexos

### boletoGerarResponse / boletoObterResponse / boletoProrrogarResponse

| Campo | Tipo | Descrição |
|---|---|---|
| `cLinkBoleto` | string(500) | Link do boleto |
| `cCodStatus` | string(4) | Código do status |
| `cDesStatus` | text | Descrição do status |
| `dDtEmBol` | date | Data de emissão |
| `cNumBoleto` | string(30) | Número do boleto |
| `cCodBarras` | string(70) | Código de barras |
| `nPerJuros` | decimal | % juros |
| `nPerMulta` | decimal | % multa |
| `cNumBancario` | string(30) | Número bancário |
| `dDescontoCond1` | date | Data desconto condicional 1 |
| `vDescontoCond1` | decimal | Valor desconto condicional 1 |
| `dDescontoCond2` | date | Data desconto condicional 2 |
| `vDescontoCond2` | decimal | Valor desconto condicional 2 |
| `dDescontoCond3` | date | Data desconto condicional 3 |
| `vDescontoCond3` | decimal | Valor desconto condicional 3 |

---

**Última atualização:** 2026-03-21
**Versão:** 1.0.0
