# API Países — ListarPaises (Padrão Omie)

## Visão Geral

Edge Function `paises-api` — lista países cadastrados com código IBGE, descrição e código ISO.

**Base URL:** `https://aokkyrgaqjarhlywhjju.supabase.co/functions/v1/paises-api`

## Autenticação

Header `x-api-key` obrigatório (exceto `/status`).

## Rotas

### GET `/status`

Health check (sem autenticação).

**Resposta:**
```json
{ "status": "ok", "function": "paises-api", "routes": ["/listar", "/status"] }
```

### POST `/listar` — ListarPaises

Lista países cadastrados com filtros opcionais.

**Request Body:**
```json
{
  "filtrar_por_codigo": "",
  "filtrar_por_descricao": "",
  "filtrar_por_codigo_iso": ""
}
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `filtrar_por_codigo` | string(4) | Não | Filtro parcial por código IBGE (ILIKE) |
| `filtrar_por_descricao` | string | Não | Filtro parcial por descrição (ILIKE) |
| `filtrar_por_codigo_iso` | string(2) | Não | Filtro parcial por código ISO (ILIKE) |

**Resposta:**
```json
{
  "lista_paises": [
    {
      "cCodigo": "1058",
      "cDescricao": "BRASIL",
      "cCodigoISO": "BR"
    }
  ],
  "meta": {
    "processed_at": "2026-03-21T...",
    "duration_ms": 45
  }
}
```

## Mapeamento de Campos

| Campo Omie | Coluna DB | Tipo |
|---|---|---|
| `cCodigo` | `codigo` | varchar(4) |
| `cDescricao` | `descricao` | varchar(30) |
| `cCodigoISO` | `codigo_iso` | varchar(2) |

## Exemplos

### Listar todos os países
```bash
curl -X POST https://…/paises-api/listar \
  -H "x-api-key: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Filtrar por descrição
```bash
curl -X POST https://…/paises-api/listar \
  -H "x-api-key: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{"filtrar_por_descricao": "BRASIL"}'
```

### Filtrar por código ISO
```bash
curl -X POST https://…/paises-api/listar \
  -H "x-api-key: SUA_CHAVE" \
  -H "Content-Type: application/json" \
  -d '{"filtrar_por_codigo_iso": "BR"}'
```
