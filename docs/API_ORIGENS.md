# API Origens de Lançamento — ListarOrigem

Edge Function: `origens-api`  
Padrão: Huggs `origem_lanc_listar_response`

## Endpoints

| Método | Rota | Equivalente Huggs | Descrição |
|---|---|---|---|
| POST | `/listar` | ListarOrigem | Lista origens de lançamento |
| GET | `/status` | — | Health check |

## Autenticação

Header `x-api-key` obrigatório (exceto `/status`).

## POST /listar

**Body (`origem_lanc_listar_request`):**
```json
{ "codigo": "" }
```

- `codigo` vazio ou ausente → retorna todas as origens ativas
- `codigo` preenchido → filtra com `ilike`

**Resposta (200) (`origem_lanc_listar_response`):**
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 6,
  "total_de_registros": 6,
  "origem": [
    { "codigo": "MANUAL", "descricao": "Lançamento Manual" },
    { "codigo": "API", "descricao": "Importado via API" }
  ]
}
```

## Mapeamento de Campos

| Campo Huggs (`origem`) | Coluna DB | Observação |
|---|---|---|
| `codigo` | `codigo` | Código da origem |
| `descricao` | `descricao` | Descrição |

## Erros

| Código | Descrição |
|---|---|
| 401 | API key inválida |
| 404 | Rota inválida |
| 500 | Erro interno |
