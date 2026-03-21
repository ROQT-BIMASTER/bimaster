# API Categorias — Padrão Omie

Base URL: `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/categorias-api`

## Autenticação

Header `x-api-key` com chave válida gerada no Portal de Integração.

## Endpoints

### POST `/incluir` — IncluirCategoria

Inclui uma nova categoria.

**Body:**
```json
{
  "descricao": "Serviços Terceiros",
  "tipo_categoria": "D",
  "natureza": "Despesas com serviços",
  "codigo_dre": "3.01.01",
  "categoria_superior": ""
}
```

### POST `/incluir-grupo` — IncluirGrupoCategoria

Inclui um grupo totalizador de categorias.

**Body:**
```json
{
  "descricao": "Despesas Operacionais",
  "tipo_grupo": "D",
  "natureza": "Grupo de despesas operacionais"
}
```

### POST `/alterar` — AlterarCategoria

Altera dados de uma categoria existente.

**Body:**
```json
{
  "codigo": "CAT-001",
  "descricao": "Serviços Terceiros Atualizado",
  "tipo_categoria": "D",
  "codigo_dre": "3.01.01",
  "conta_inativa": "N"
}
```

### POST `/alterar-grupo` — AlterarGrupoCategoria

Altera dados de um grupo totalizador.

**Body:**
```json
{
  "codigo": "GRP-001",
  "descricao": "Despesas Operacionais Atualizado",
  "natureza": "Observação atualizada"
}
```

### POST `/consultar` — ConsultarCategoria

Consulta uma categoria por código.

**Body:**
```json
{ "codigo": "CAT-001" }
```

**Resposta:**
```json
{
  "categoria_cadastro": {
    "codigo": "CAT-001",
    "descricao": "Serviços Terceiros",
    "tipo_categoria": "D",
    "conta_inativa": "N",
    "conta_despesa": "S",
    "conta_receita": "N",
    "totalizadora": "N",
    "natureza": "Despesas com serviços",
    "codigo_dre": "3.01.01",
    "categoria_superior": "",
    "dadosDRE": {
      "codigoDRE": "3.01.01",
      "descricaoDRE": "",
      "naoExibirDRE": "N",
      "nivelDRE": 0,
      "sinalDRE": "",
      "totalizaDRE": "N"
    }
  }
}
```

### POST `/listar` — ListarCategorias

Lista categorias com paginação e filtros.

**Body:**
```json
{
  "pagina": 1,
  "registros_por_pagina": 50,
  "filtrar_apenas_ativo": "S",
  "filtrar_por_tipo": "D"
}
```

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `pagina` | integer | Página (default 1) |
| `registros_por_pagina` | integer | Registros por página (máx 500) |
| `filtrar_apenas_ativo` | string | "S" para apenas ativas |
| `filtrar_por_tipo` | string | "R" para receita, "D" para despesa |

### GET `/status` — Health Check

Retorna status do serviço.

## Mapeamento de Campos (Omie → DB)

| Campo Omie | Coluna DB |
|---|---|
| `codigo` | `code` |
| `descricao` | `name` |
| `tipo_categoria` | `tipo_categoria` |
| `conta_inativa` | `is_active` (invertido) |
| `natureza` | `description` |
| `totalizadora` | `is_group` |
| `codigo_dre` | `codigo_dre` |
| `categoria_superior` | `parent_account_id` (UUID, resolvido via code) |
