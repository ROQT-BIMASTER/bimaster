# API Tipos de Anexo — API Huggs

## Base URL

```
https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/tipos-anexo-api
```

## Autenticação

Header `x-api-key` com chave válida cadastrada no Portal de Integração.

---

## Endpoints

### GET /status

Health check.

**Response:**
```json
{ "status": "ok", "function": "tipos-anexo-api", "routes": ["/listar", "/status"] }
```

### POST /listar — ListarTiposAnexos

Lista os tipos de anexos cadastrados.

**Request:**
```json
{
  "codigo": ""
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `codigo` | string(10) | Não | Filtro parcial por código (ILIKE) |

**Response:**
```json
{
  "listaTipoAnexo": [
    { "codigo": "NF", "descricao": "Nota Fiscal" },
    { "codigo": "CT", "descricao": "Contrato" },
    { "codigo": "CP", "descricao": "Comprovante de Pagamento" }
  ],
  "meta": { "processed_at": "2026-03-21T...", "duration_ms": 10 }
}
```

---

## Mapeamento Huggs

| Campo Huggs | Coluna DB |
|---|---|
| `codigo` | `codigo` |
| `descricao` | `descricao` |

## Tabela

`public.tipos_anexo` — Lookup de tipos de anexo (código até 10 chars + descrição).
