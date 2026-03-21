# API Tipos de Atividade — Padronização Omie

## Base URL

```
https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/tipos-atividade-api
```

## Autenticação

Header `x-api-key` com chave válida cadastrada no Portal de Integração.

---

## Endpoints

### GET /status

Health check.

**Response:**
```json
{ "status": "ok", "function": "tipos-atividade-api", "routes": ["/listar", "/status"] }
```

### POST /listar — ListarTipoAtiv

Lista os tipos de atividade da empresa.

**Request:**
```json
{
  "filtrar_por_codigo": "",
  "filtrar_por_descricao": ""
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `filtrar_por_codigo` | string | Não | Filtro parcial por código (ILIKE) |
| `filtrar_por_descricao` | string | Não | Filtro parcial por descrição (ILIKE) |

**Response:**
```json
{
  "lista_tipos_atividade": [
    { "cCodigo": "C", "cDescricao": "Comércio" },
    { "cCodigo": "I", "cDescricao": "Indústria" },
    { "cCodigo": "S", "cDescricao": "Serviços" }
  ],
  "meta": { "processed_at": "2026-03-21T...", "duration_ms": 12 }
}
```

---

## Mapeamento Omie

| Campo Omie | Coluna DB |
|---|---|
| `cCodigo` | `codigo` |
| `cDescricao` | `descricao` |

## Tabela

`public.tipos_atividade_empresa` — Lookup de tipos de atividade (código 1 char + descrição).
