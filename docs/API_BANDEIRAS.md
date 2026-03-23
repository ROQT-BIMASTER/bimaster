# API Bandeiras de Cartão — ListarBandeiras

Edge Function: `bandeiras-api`  
Padrão: Huggs `ListarBandeirasResponse`

## Endpoints

| Método | Rota | Equivalente Huggs | Descrição |
|---|---|---|---|
| GET | `/listar?nPagina=1&nRegPorPagina=50` | ListarBandeiras | Lista paginada de bandeiras |
| GET | `/status` | — | Health check |

## Autenticação

Header `x-api-key` obrigatório (exceto `/status`).

## GET /listar

**Query params:**

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `nPagina` | integer | 1 | Número da página |
| `nRegPorPagina` | integer | 50 | Registros por página (max 500) |

**Resposta (200) (`ListarBandeirasResponse`):**
```json
{
  "nPagina": 1,
  "nTotPaginas": 1,
  "nRegistros": 8,
  "nTotRegistros": 8,
  "listaBandeira": [
    { "cCodigo": "VISA", "cDescricao": "Visa", "cTipo": "credito" },
    { "cCodigo": "MASTER", "cDescricao": "Mastercard", "cTipo": "credito" }
  ]
}
```

## Mapeamento de Campos

| Campo Huggs (`listaBandeira`) | Coluna DB | Observação |
|---|---|---|
| `cCodigo` | `codigo` | Código da bandeira |
| `cDescricao` | `descricao` | Descrição da bandeira |
| `cTipo` | `tipo` | Tipo: credito, debito, ambos |

## Erros

| Código | Descrição |
|---|---|
| 401 | API key inválida |
| 404 | Rota inválida |
| 500 | Erro interno |
