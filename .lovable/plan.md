

# API Bandeiras de Cartão (ListarBandeiras) — Padronização Omie

## Resumo

Criar Edge Function `bandeiras-api` com 1 rota paginada seguindo o padrão Omie. Usa tabela `bandeiras_cartao` existente (id, codigo, descricao, tipo, ativo).

## 1. Nova Edge Function: `bandeiras-api`

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| GET | `/listar?nPagina=1&nRegPorPagina=50` | ListarBandeiras | Lista paginada de bandeiras |
| GET | `/status` | — | Health check |

### GET /listar

Query params: `nPagina` (default 1), `nRegPorPagina` (default 50, max 500).

**Resposta (`ListarBandeirasResponse`):**
```json
{
  "nPagina": 1,
  "nTotPaginas": 1,
  "nRegistros": 8,
  "nTotRegistros": 8,
  "listaBandeira": [
    { "cCodigo": "VISA", "cDescricao": "Visa" },
    { "cCodigo": "MASTER", "cDescricao": "Mastercard" }
  ]
}
```

**Mapeamento:** `codigo` → `cCodigo`, `descricao` → `cDescricao`.

Autenticação: `validateApiKey`.

## 2. Documentação

Novo `docs/API_BANDEIRAS.md`.

## 3. API Tester & Portal

- Preset no `ApiTester.tsx` (Listar Bandeiras)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/bandeiras-api/index.ts` | Criar |
| `docs/API_BANDEIRAS.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — preset |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

