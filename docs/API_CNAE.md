# API CNAE — Padronização Omie

## Base URL

```
https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/cnae-api
```

## Autenticação

Header `x-api-key` com chave válida cadastrada no Portal de Integração.

---

## Endpoints

### GET /status

Health check.

**Response:**
```json
{ "status": "ok", "function": "cnae-api", "routes": ["/listar", "/status"] }
```

### POST /listar — ListarCNAE

Lista os CNAEs cadastrados com paginação e ordenação.

**Request:**
```json
{
  "pagina": 1,
  "registros_por_pagina": 50,
  "ordenar_por": "codigo",
  "ordem_decrescente": "N"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `pagina` | integer | Não | Número da página (default: 1) |
| `registros_por_pagina` | integer | Não | Registros por página (default: 50, máx: 500) |
| `ordenar_por` | string | Não | Campo de ordenação: `codigo` ou `descricao` (default: codigo) |
| `ordem_decrescente` | string | Não | `S` para ordem decrescente |

**Response:**
```json
{
  "pagina": 1,
  "total_de_paginas": 10,
  "registros": 50,
  "total_de_registros": 500,
  "cadastros": [
    { "nCodigo": "4711302", "cDescricao": "Comércio varejista de mercadorias em geral", "cEstrutura": "47.11-3/02" }
  ],
  "meta": { "processed_at": "2026-03-21T...", "duration_ms": 15 }
}
```

---

## Mapeamento Omie

| Campo Omie | Coluna DB |
|---|---|
| `nCodigo` | `codigo` |
| `cDescricao` | `descricao` |
| `cEstrutura` | `estrutura` |

## Tabela

`public.cnaes` — Lookup de códigos CNAE (código 7 chars + descrição + estrutura).
