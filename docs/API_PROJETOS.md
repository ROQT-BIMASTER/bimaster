# API Projetos — API Huggs

Edge Function: `projetos-api`  
Autenticação: `x-api-key`

## Endpoints

| Rota | Descrição | Equivalente Huggs |
|---|---|---|
| POST `/incluir` | Inclui projeto | IncluirProjeto |
| POST `/alterar` | Altera projeto | AlterarProjeto |
| POST `/consultar` | Consulta projeto | ConsultarProjeto |
| POST `/excluir` | Exclui (soft delete) | ExcluirProjeto |
| POST `/listar` | Lista paginada | ListarProjetos |
| POST `/upsert` | Inclui ou altera | UpsertProjeto |
| GET `/status` | Health check | — |

## Mapeamento de Campos

| Campo Huggs | Coluna DB | Observação |
|---|---|---|
| `codigo` | `id` | UUID |
| `codInt` | `codigo_integracao` | varchar(20), unique |
| `nome` | `nome` | Nome do projeto |
| `inativo` | `status` | `"S"` → finalizado |
| `info.data_inc` | `created_at` | — |
| `info.data_alt` | `updated_at` | — |

## Exemplos

### POST /incluir

```json
{
  "codInt": "PROJ-001",
  "nome": "Projeto Alpha",
  "inativo": "N"
}
```

**Resposta:**
```json
{
  "codigo": "uuid",
  "codInt": "PROJ-001",
  "status": "0",
  "descricao": "Projeto incluído com sucesso!"
}
```

### POST /consultar

```json
{ "codInt": "PROJ-001" }
```

**Resposta:**
```json
{
  "codigo": "uuid",
  "codInt": "PROJ-001",
  "nome": "Projeto Alpha",
  "inativo": "N",
  "info": {
    "data_inc": "2026-03-21",
    "hora_inc": "18:00:00",
    "data_alt": "2026-03-21",
    "hora_alt": "18:00:00"
  }
}
```

### POST /listar

```json
{
  "pagina": 1,
  "registros_por_pagina": 50,
  "nome_projeto": "Alpha",
  "apenas_importado_api": "N"
}
```

**Resposta:**
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 1,
  "total_de_registros": 1,
  "cadastro": [{ "codigo": "uuid", "codInt": "PROJ-001", "nome": "Projeto Alpha", "inativo": "N", "info": {...} }]
}
```

### POST /alterar

```json
{
  "codInt": "PROJ-001",
  "nome": "Projeto Alpha Atualizado",
  "inativo": "N"
}
```

### POST /excluir

```json
{ "codInt": "PROJ-001" }
```

### POST /upsert

```json
{
  "codInt": "PROJ-001",
  "nome": "Projeto Alpha",
  "inativo": "N"
}
```

## Erros

| Código | Descrição |
|---|---|
| 400 | Campos obrigatórios ausentes |
| 401 | API key inválida |
| 404 | Projeto não encontrado |
| 409 | codInt duplicado |
| 500 | Erro interno |
