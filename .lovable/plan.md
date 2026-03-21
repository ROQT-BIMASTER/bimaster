

# API Cidades (PesquisarCidades) — Padronização Omie

## Resumo

Criar Edge Function `cidades-api` com 1 rota (PesquisarCidades) que consulta a tabela **`ibge_municipios` já existente** (5.570+ registros). Não é necessário criar tabela nova — apenas expor os dados via API no formato Omie.

O campo `id` da tabela `ibge_municipios` já é o código IBGE (integer). A coluna `uf_sigla` já existe. Precisamos apenas montar o `cCod` no formato Omie (ex: `"SAO PAULO (SP)"`).

## 1. Migration

Nenhuma tabela nova. Apenas adicionar coluna `codigo_siafi` se necessário para o campo `nCodSIAFI`:

```sql
ALTER TABLE public.ibge_municipios
  ADD COLUMN IF NOT EXISTS codigo_siafi integer;
```

## 2. Edge Function: `cidades-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/listar` | PesquisarCidades | Lista paginada com filtros |
| GET `/status` | — | Health check |

## 3. Mapeamento

| Campo Omie | Fonte |
|---|---|
| `cCod` | `UPPER(nome) \|\| ' (' \|\| uf_sigla \|\| ')'` |
| `cNome` | `nome` |
| `cUF` | `uf_sigla` |
| `nCodIBGE` | `id` (cast to string) |
| `nCodSIAFI` | `codigo_siafi` (nova coluna) |

Filtros suportados:
- `filtrar_cidade_contendo` → ILIKE no nome
- `filtrar_por_uf` → eq em `uf_sigla`
- `filtrar_por_cidade` → eq no `cCod` construído
- Paginação + ordenação padrão

## 4. Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | +1 coluna `codigo_siafi` em `ibge_municipios` |
| `supabase/functions/cidades-api/index.ts` | Criar |
| `docs/API_CIDADES.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Presets |
| `src/components/erp/ApiDocumentation.tsx` | Seção |

