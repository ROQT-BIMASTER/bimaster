# API Finalidades de Transferência — ConsultarFinalTransf + ListarFinalTransf

Edge Function: `finalidades-transferencia-api`  
Padrão: Omie `final_transf_list_response`

## Endpoints

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| GET | `/consultar?codigo=01` | ConsultarFinalTransf | Consulta finalidade por código |
| GET | `/listar?pagina=1&registros_por_pagina=50` | ListarFinalTransf | Lista paginada |
| GET | `/status` | — | Health check |

## Autenticação

Header `x-api-key` obrigatório (exceto `/status`).

## GET /consultar

**Query params:**
- `codigo` (obrigatório) — Código da finalidade
- `banco` (opcional, ignorado — sem coluna banco na tabela)

**Resposta (200) (`cadastros`):**
```json
{
  "banco": "",
  "codigo": "01",
  "descricao": "Crédito em Conta"
}
```

## GET /listar

**Query params:**
- `pagina` — Número da página (default: 1)
- `registros_por_pagina` — Registros por página (default: 50, máx: 500)
- `filtrar_por_banco` — Aceito mas ignorado (sem coluna banco)

**Resposta (200) (`final_transf_list_response`):**
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 8,
  "total_de_registros": 8,
  "cadastros": [
    { "banco": "", "codigo": "01", "descricao": "Crédito em Conta" }
  ]
}
```

## Mapeamento de Campos

| Campo Omie (`cadastros`) | Coluna DB | Observação |
|---|---|---|
| `banco` | — | Retorna `""` (não disponível) |
| `codigo` | `codigo` | Código da finalidade |
| `descricao` | `descricao` | Descrição |

## Erros

| Código | Descrição |
|---|---|
| 400 | Parâmetro ausente |
| 401 | API key inválida |
| 404 | Não encontrado / Rota inválida |
| 500 | Erro interno |
