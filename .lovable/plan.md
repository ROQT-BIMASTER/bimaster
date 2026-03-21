

# API Origens de Lançamento (ListarOrigem) — Padronização Omie

## Resumo

Criar nova Edge Function `origens-api` com 1 rota seguindo o padrão Omie `ListarOrigem`. Usa tabela `origens_titulo` existente (id, codigo, descricao, ativo). Sem nova tabela.

## 1. Nova Edge Function: `origens-api`

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| POST | `/listar` | ListarOrigem | Lista origens de lançamento (filtro por código) |
| GET | `/status` | — | Health check |

### POST /listar

**Body (`origem_lanc_listar_request`):**
```json
{ "codigo": "" }
```
- `codigo` vazio ou ausente → retorna todas as origens ativas
- `codigo` preenchido → filtra com `ilike`

**Resposta (`origem_lanc_listar_response`):**
```json
{
  "pagina": 1,
  "total_de_paginas": 1,
  "registros": 6,
  "total_de_registros": 6,
  "origem": [
    { "codigo": "MANUAL", "descricao": "Lançamento Manual" },
    { "codigo": "API", "descricao": "Importado via API" }
  ]
}
```

Mapeamento direto: `codigo` → `codigo`, `descricao` → `descricao`.

Autenticação: `validateApiKey`.

## 2. Documentação

Novo `docs/API_ORIGENS.md`.

## 3. API Tester & Portal

- Presets no `ApiTester.tsx` (Listar Origens, Listar por Código)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/origens-api/index.ts` | Criar |
| `docs/API_ORIGENS.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

