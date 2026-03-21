# API Departamentos — Padrão Huggs

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/departamentos-api`

**Autenticação:** Header `x-api-key` com chave válida.

---

## Endpoints

### POST /incluir — IncluirDepartamento

Inclui um novo departamento.

**Request:**
```json
{
  "codigo": "000000000723648",
  "descricao": "Marketing Digital"
}
```

**Response (201):**
```json
{
  "codigo": "000000000723648",
  "descricao": "Marketing Digital",
  "cCodStatus": "0",
  "cDesStatus": "Departamento incluído com sucesso"
}
```

---

### POST /alterar — AlterarDepartamento

Altera um departamento existente (busca por `codigo`).

**Request:**
```json
{
  "codigo": "000000000723648",
  "descricao": "Marketing Digital Atualizado"
}
```

**Response:**
```json
{
  "codigo": "000000000723648",
  "descricao": "Marketing Digital Atualizado",
  "cCodStatus": "0",
  "cDesStatus": "Departamento alterado com sucesso"
}
```

---

### POST /consultar — ConsultarDepartamento

Consulta um departamento por código.

**Request:**
```json
{
  "codigo": "000000000723648"
}
```

**Response:**
```json
{
  "codigo": "000000000723648",
  "descricao": "Marketing Digital",
  "estrutura": "",
  "inativo": "N",
  "nivel_totalizador": "N",
  "info": {
    "dInc": "21/03/2026",
    "dAlt": ""
  }
}
```

---

### POST /excluir — ExcluirDepartamento

Exclui (soft delete) um departamento.

**Request:**
```json
{
  "codigo": "000000000723648"
}
```

**Response:**
```json
{
  "codigo": "000000000723648",
  "descricao": "Marketing Digital",
  "cCodStatus": "0",
  "cDesStatus": "Departamento excluído com sucesso"
}
```

---

### POST /listar — ListarDepartamentos

Lista departamentos com paginação.

**Request:**
```json
{
  "pagina": 1,
  "registros_por_pagina": 50
}
```

**Response:**
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 3,
  "total_de_registros": 3,
  "departamentos": [
    {
      "codigo": "000000000723648",
      "descricao": "Marketing Digital",
      "estrutura": "",
      "inativo": "N",
      "nivel_totalizador": "N"
    }
  ]
}
```

---

### GET /status — Health Check

**Response:**
```json
{
  "status": "ok",
  "service": "departamentos-api",
  "timestamp": "2026-03-21T00:00:00.000Z"
}
```

---

## Mapeamento de Campos

| Campo Huggs | Coluna DB | Tipo |
|---|---|---|
| `codigo` | `codigo_huggs` | varchar(40) |
| `descricao` | `nome` | text |
| `estrutura` | `estrutura` | varchar(40) |
| `inativo` | `ativo` (invertido) | boolean |
| `nivel_totalizador` | `nivel_totalizador` | varchar(1) |
