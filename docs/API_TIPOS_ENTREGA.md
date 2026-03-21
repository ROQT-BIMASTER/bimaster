# API Tipos de Entrega — CRUD Completo (Padrão Omie)

## Base URL

```
https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/tipos-entrega-api
```

## Autenticação

Header `x-api-key` com chave válida cadastrada no Portal de Integração.

---

## Endpoints

### GET /status

Health check.

### POST /incluir — IncluirTipoEntrega

**Request:**
```json
{
  "nCodTransp": 0,
  "cCodIntEntrega": "",
  "cDescricao": "Entrega Normal",
  "cInativo": "N"
}
```

**Response (201):**
```json
{
  "nCodEntrega": 1,
  "cCodIntEntrega": "",
  "cCodStatus": "0",
  "cDesStatus": "Tipo de entrega incluído com sucesso"
}
```

### POST /alterar — AlterarTipoEntrega

**Request:**
```json
{
  "nCodEntrega": 1,
  "cDescricao": "Entrega Expressa",
  "cInativo": "N"
}
```

### POST /consultar — ConsultarTipoEntrega

**Request:**
```json
{
  "nCodEntrega": 1,
  "cCodIntEntrega": ""
}
```

**Response:** Objeto `CadTiposEntrega`.

### POST /excluir — ExcluirTipoEntrega

**Request:**
```json
{
  "nCodEntrega": 1,
  "cCodIntEntrega": ""
}
```

### POST /listar — ListarTipoEntrega

**Request:**
```json
{
  "nPagina": 1,
  "nRegistrosPorPagina": 50,
  "nCodTransp": 0
}
```

**Response:**
```json
{
  "nPagina": 1,
  "nTotalPaginas": 1,
  "nRegistros": 2,
  "nTotalRegistros": 2,
  "CadTiposEntrega": [
    { "nCodTransp": 0, "nCodEntrega": 1, "cCodIntEntrega": "", "cDescricao": "Normal", "cInativo": "N" }
  ]
}
```

## Mapeamento

| Campo Omie | Coluna DB |
|---|---|
| `nCodEntrega` | `n_cod_entrega` |
| `nCodTransp` | `n_cod_transp` |
| `cCodIntEntrega` | `c_cod_int_entrega` |
| `cDescricao` | `c_descricao` |
| `cInativo` | `c_inativo` |
