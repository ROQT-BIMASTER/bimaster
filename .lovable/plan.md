

# API Tipos de Documento (ConsultarTipoDocumento + PesquisarTipoDocumento) — Padronização Omie

## Resumo

Criar nova Edge Function `tipos-documento-api` com 2 rotas seguindo o padrão Omie. Consulta a tabela `tipos_documento` existente (id, codigo, descricao, ativo).

## 1. Nova Edge Function: `tipos-documento-api`

Sem nova tabela — usa `tipos_documento` existente.

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| GET | `/consultar?codigo=NF` | ConsultarTipoDocumento | Consulta tipo por código |
| POST | `/pesquisar` | PesquisarTipoDocumento | Pesquisa tipos (filtro por código parcial) |
| GET | `/status` | — | Health check |

### GET /consultar
Query param: `codigo` (ex: "NF", "BOLETO").

Resposta (`tipo_documento_cadastro`):
```json
{
  "codigo": "NF",
  "descricao": "Nota Fiscal"
}
```

### POST /pesquisar
Body: `{ "codigo": "" }` — string vazia retorna todos, valor parcial filtra com `ilike`.

Resposta (`tipo_documento_pesquisa_response`):
```json
{
  "tipo_documento_cadastro": [
    { "codigo": "NF", "descricao": "Nota Fiscal" },
    { "codigo": "NFE", "descricao": "NF-e (Eletrônica)" }
  ]
}
```

Mapeamento direto: `codigo` → `codigo`, `descricao` → `descricao`.

Autenticação: `validateApiKey` (mesmo padrão das outras APIs).

## 2. Documentação

Novo `docs/API_TIPOS_DOCUMENTO.md`.

## 3. API Tester & Portal

- Presets no `ApiTester.tsx` (Consultar Tipo, Pesquisar Tipos)
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/tipos-documento-api/index.ts` | Criar |
| `docs/API_TIPOS_DOCUMENTO.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

