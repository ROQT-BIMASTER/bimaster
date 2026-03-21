# API DRE Cadastro — ListarCadastroDRE

Edge Function: `dre-cadastro-api`  
Padrão: Omie `dreCadastroListResponse`

## Endpoints

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| POST | `/listar` | ListarCadastroDRE | Lista contas do DRE |
| GET | `/status` | — | Health check |

## Autenticação

Header `x-api-key` obrigatório (exceto `/status`).

## POST /listar

**Body (`dreCadastroListRequest`):**
```json
{
  "apenasContasAtivas": "N"
}
```
- `apenasContasAtivas` — `"S"` para listar apenas contas ativas, `"N"` para todas

**Resposta (200) (`dreCadastroListResponse`):**
```json
{
  "totalRegistros": 25,
  "dreLista": [
    {
      "codigoDRE": "4.1",
      "descricaoDRE": "Receita Bruta",
      "naoExibirDRE": "N",
      "nivelDRE": 2,
      "sinalDRE": "+",
      "totalizaDRE": "N"
    }
  ]
}
```

## Mapeamento de Campos

| Campo Omie (`dreLista`) | Coluna DB | Observação |
|---|---|---|
| `codigoDRE` | `codigo_dre_gerencial` ou `code` | Código da conta DRE |
| `descricaoDRE` | `name` | Descrição da conta |
| `naoExibirDRE` | `!is_active` → `"S"/"N"` | Visibilidade no DRE |
| `nivelDRE` | Calculado do `code` (pontos + 1) | Ex: "3.2.1" → nível 3 |
| `sinalDRE` | `categoria_dre`: receita → `"+"`, outros → `"-"` | Sinal da conta |
| `totalizaDRE` | `"N"` (default) | Sem campo equivalente |

## Erros

| Código | Descrição |
|---|---|
| 401 | API key inválida |
| 404 | Rota não encontrada |
| 500 | Erro interno |
