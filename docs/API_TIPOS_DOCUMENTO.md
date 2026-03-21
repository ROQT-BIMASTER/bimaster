# API Tipos de Documento — ConsultarTipoDocumento + PesquisarTipoDocumento

Edge Function: `tipos-documento-api`  
Padrão: Huggs `tipo_documento_cadastro`

## Endpoints

| Método | Rota | Equivalente Huggs | Descrição |
|---|---|---|---|
| GET | `/consultar?codigo=NF` | ConsultarTipoDocumento | Consulta tipo por código |
| POST | `/pesquisar` | PesquisarTipoDocumento | Pesquisa tipos (filtro parcial) |
| GET | `/status` | — | Health check |

## Autenticação

Header `x-api-key` obrigatório (exceto `/status`).

## GET /consultar

**Query Params:**
- `codigo` (obrigatório) — Código do tipo de documento (ex: "NF", "BOLETO")

**Resposta (200):**
```json
{
  "codigo": "NF",
  "descricao": "Nota Fiscal"
}
```

## POST /pesquisar

**Body:**
```json
{
  "codigo": ""
}
```
- `codigo` — String vazia retorna todos, valor parcial filtra com `ilike`

**Resposta (200):**
```json
{
  "tipo_documento_cadastro": [
    { "codigo": "NF", "descricao": "Nota Fiscal" },
    { "codigo": "NFE", "descricao": "NF-e (Eletrônica)" }
  ]
}
```

## Mapeamento de Campos

| Campo Huggs | Coluna DB | Observação |
|---|---|---|
| `codigo` | `codigo` | Código do tipo (máx 5 chars) |
| `descricao` | `descricao` | Descrição do tipo (máx 50 chars) |

## Erros

| Código | Descrição |
|---|---|
| 400 | Parâmetro `codigo` ausente |
| 401 | API key inválida |
| 404 | Tipo de documento não encontrado |
| 500 | Erro interno |
