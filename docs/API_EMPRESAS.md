# API Empresas — API Huggs

Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/empresas-api`

## Autenticação

Header `x-api-key` obrigatório em todas as rotas (exceto `/status`).

## Rotas

### GET /status
Health check.

### POST /consultar
Consulta uma empresa por código.

**Request:**
```json
{ "codigo_empresa": 8 }
```

**Response:** `empresas_cadastro` (objeto com campos Huggs).

### POST /listar
Lista empresas com paginação.

**Request:**
```json
{
  "pagina": 1,
  "registros_por_pagina": 100
}
```

**Response:**
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 2,
  "total_de_registros": 2,
  "empresas_cadastro": [
    {
      "codigo_empresa": 8,
      "razao_social": "Empresa ABC",
      "cnpj": "12.345.678/0001-90",
      "estado": "SP",
      "inativa": "N",
      "inclusao_data": "15/01/2026",
      "..."
    }
  ]
}
```

## Mapeamento de Campos

| Campo Huggs | Coluna DB | Obs |
|---|---|---|
| `codigo_empresa` | `id` | SERIAL |
| `razao_social` | `nome` | — |
| `nome_fantasia` | `nome` | Igual razao_social |
| `cnpj` | `cnpj` | — |
| `estado` | `uf` | — |
| `inativa` | `ativa` invertido | `true` → `"N"` |
| `inclusao_data` | `created_at` | Formatado dd/mm/yyyy |
| Demais campos | — | Retornados como string vazia |
