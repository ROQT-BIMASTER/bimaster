# API Parcelas (Condições de Pagamento) — API Huggs

Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/parcelas-api`

## Autenticação

Header `x-api-key` com chave válida gerada no Portal de Integração.

## Endpoints

### POST `/incluir` — IncluirParcela

Inclui uma nova condição de parcelamento.

**Body:**
```json
{
  "cParcela": "30/60/90"
}
```

**Resposta:**
```json
{
  "cCodStatus": "0",
  "cDesStatus": "Parcela incluída com sucesso!",
  "cCodParcela": "001",
  "cDesParcela": "30/60/90"
}
```

### POST `/listar` — ListarParcelas

Lista condições de parcelamento cadastradas com paginação.

**Body:**
```json
{
  "pagina": 1,
  "registros_por_pagina": 50
}
```

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `pagina` | integer | Página (default 1) |
| `registros_por_pagina` | integer | Registros por página (máx 500) |
| `apenas_importado_api` | string | "S" para apenas importados via API |
| `ordem_decrescente` | string | "S" para ordem decrescente |

**Resposta:**
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 3,
  "total_de_registros": 3,
  "cadastros": [
    {
      "nCodigo": "001",
      "cDescricao": "À Vista",
      "nParcelas": 1
    }
  ]
}
```

### GET `/status` — Health Check

Retorna status do serviço.

## Mapeamento de Campos (Huggs → DB)

| Campo Huggs | Coluna DB |
|---|---|
| `nCodigo` | `codigo` |
| `cDescricao` | `descricao` |
| `nParcelas` | `numero_parcelas` |
