# API Bancos — ConsultarBanco + ListarBancos

Edge Function: `bancos-api`  
Padrão: Huggs `fin_banco_cadastro`

## Endpoints

| Método | Rota | Equivalente Huggs | Descrição |
|---|---|---|---|
| GET | `/consultar?codigo=001` | ConsultarBanco | Consulta banco por código COMPE |
| GET | `/listar?pagina=1&registros_por_pagina=100` | ListarBancos | Lista paginada de bancos |
| GET | `/status` | — | Health check |

## Autenticação

Header `x-api-key` obrigatório (exceto `/status`).

## GET /consultar

**Query Params:**
- `codigo` (obrigatório) — Código COMPE do banco (ex: "001", "341")

**Resposta (200):**
```json
{
  "codigo": "001",
  "nome": "Banco do Brasil S.A.",
  "tipo": "CB",
  "cod_compen": "001",
  "cod_ispb": "00000000",
  "cnab_cob": "N",
  "cnab_pag": "N",
  "obank_sn": "N",
  "obank_pix": "N"
}
```

## GET /listar

**Query Params:**
- `pagina` (default: 1)
- `registros_por_pagina` (default: 100, máx: 500)
- `tipo` — Tipo da conta (CB, CX, CV, AC). Informativo.

**Resposta (200):**
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 50,
  "total_de_registros": 50,
  "fin_banco_cadastro": [
    {
      "codigo": "001",
      "nome": "Banco do Brasil S.A.",
      "tipo": "CB",
      "cod_compen": "001",
      "cod_ispb": "00000000"
    }
  ]
}
```

## Mapeamento de Campos

| Campo Huggs | Coluna DB | Observação |
|---|---|---|
| `codigo` | `codigo_compe` | Código COMPE |
| `nome` | `nome` | Nome completo |
| `cod_compen` | `codigo_compe` | Mesmo que `codigo` |
| `cod_ispb` | `ispb` | Código ISPB |
| CNAB/Crawler/OpenBanking | — | Retorna `"N"` (não disponível) |

## Erros

| Código | Descrição |
|---|---|
| 400 | Parâmetro `codigo` ausente |
| 401 | API key inválida |
| 404 | Banco não encontrado |
| 500 | Erro interno |
