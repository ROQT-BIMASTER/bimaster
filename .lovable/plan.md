

# API Departamentos (CRUD) — Padronização Omie

## Resumo

Criar Edge Function `departamentos-api` com 5 rotas CRUD seguindo o padrão Omie. Usa tabela `departamentos` existente (id, nome, descricao, ativo, responsavel_id, created_at, updated_at). Precisa adicionar colunas `codigo` (varchar(40), código Omie), `estrutura` (varchar(40)), e `nivel_totalizador` (varchar(1)) via migration.

## 1. Migration

```sql
ALTER TABLE public.departamentos 
  ADD COLUMN IF NOT EXISTS codigo_omie varchar(40) UNIQUE,
  ADD COLUMN IF NOT EXISTS estrutura varchar(40),
  ADD COLUMN IF NOT EXISTS nivel_totalizador varchar(1) DEFAULT 'N';
```

## 2. Nova Edge Function: `departamentos-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/incluir` | IncluirDepartamento | Inclui departamento |
| POST `/alterar` | AlterarDepartamento | Altera departamento |
| POST `/consultar` | ConsultarDepartamento | Consulta por código |
| POST `/excluir` | ExcluirDepartamento | Exclui departamento |
| POST `/listar` | ListarDepartamentos | Lista paginada |
| GET `/status` | — | Health check |

## 3. Mapeamento de Campos

| Campo Omie | Coluna DB | Observação |
|---|---|---|
| `codigo` | `codigo_omie` | varchar(40) — identificador Omie |
| `descricao` | `nome` | Nome do departamento |
| `estrutura` | `estrutura` | Nova coluna |
| `inativo` | `ativo` → invertido | `ativo=true` → `inativo="N"` |
| `nivel_totalizador` | `nivel_totalizador` | Nova coluna |

## 4. Lógica

- **Incluir**: Requer `codigo` + `descricao`. Cria com `ativo=true`.
- **Alterar**: Busca por `codigo` (codigo_omie). Update de `descricao`.
- **Consultar**: Retorna cadastro completo.
- **Excluir**: Hard delete (departamento sem dados vinculados) ou soft delete (`ativo=false`). Usaremos soft delete por segurança.
- **Listar**: Paginação com `pagina` + `registros_por_pagina`.

Autenticação: `validateApiKey`.

## 5. Documentação & UI

- Novo `docs/API_DEPARTAMENTOS.md`
- Presets no `ApiTester.tsx`
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar 3 colunas |
| `supabase/functions/departamentos-api/index.ts` | Criar |
| `supabase/config.toml` | Adicionar `[functions.departamentos-api]` |
| `docs/API_DEPARTAMENTOS.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

