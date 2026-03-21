# API Cidades (PesquisarCidades) — Padrão Omie

## Base URL

```
POST {SUPABASE_URL}/functions/v1/cidades-api/listar
GET  {SUPABASE_URL}/functions/v1/cidades-api/status
```

## Autenticação

Header `x-api-key` com chave válida do Portal de Integração.

## POST /listar — PesquisarCidades

Lista paginada de cidades brasileiras a partir da tabela `ibge_municipios`.

### Request

```json
{
  "pagina": 1,
  "registros_por_pagina": 50,
  "filtrar_cidade_contendo": "PAULO",
  "filtrar_por_uf": "SP",
  "filtrar_por_cidade": "SAO PAULO (SP)",
  "ordenar_por": "nome",
  "ordem_descrescente": "N"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `pagina` | integer | Não | Número da página (default: 1) |
| `registros_por_pagina` | integer | Não | Registros por página (default: 50, máx: 500) |
| `filtrar_cidade_contendo` | string | Não | Filtro parcial por nome da cidade (ILIKE) |
| `filtrar_por_uf` | string(2) | Não | Filtro por UF (ex: "SP") |
| `filtrar_por_cidade` | string | Não | Filtro exato por cCod (ex: "SAO PAULO (SP)") |
| `ordenar_por` | string | Não | Campo de ordenação: `nome` (default) |
| `ordem_descrescente` | string(1) | Não | "S" para ordem decrescente |

### Response

```json
{
  "pagina": 1,
  "total_de_paginas": 112,
  "registros": 50,
  "total_de_registros": 5570,
  "lista_cidades": [
    {
      "cCod": "SAO PAULO (SP)",
      "cNome": "São Paulo",
      "cUF": "SP",
      "nCodIBGE": "3550308",
      "nCodSIAFI": 7107
    }
  ],
  "meta": {
    "processed_at": "2026-03-21T22:00:00.000Z",
    "duration_ms": 45
  }
}
```

## GET /status

Health check.

```json
{
  "status": "ok",
  "function": "cidades-api",
  "routes": ["/listar", "/status"]
}
```

## Mapeamento

| Campo Omie | Fonte DB (`ibge_municipios`) |
|---|---|
| `cCod` | `UPPER(nome) || ' (' || uf_sigla || ')'` |
| `cNome` | `nome` |
| `cUF` | `uf_sigla` |
| `nCodIBGE` | `id` (cast string) |
| `nCodSIAFI` | `codigo_siafi` |
