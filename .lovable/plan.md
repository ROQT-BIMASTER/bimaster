

# API Projetos (CRUD) — Padronização Omie

## Resumo

Criar Edge Function `projetos-api` com 6 rotas CRUD seguindo o padrão Omie. Usa tabela `projetos` existente. Sem nova tabela.

## 1. Nova Edge Function: `projetos-api`

| Método | Rota | Equivalente Omie | Descrição |
|---|---|---|---|
| POST | `/incluir` | IncluirProjeto | Inclui projeto |
| POST | `/alterar` | AlterarProjeto | Altera projeto |
| POST | `/consultar` | ConsultarProjeto | Consulta por código |
| POST | `/excluir` | ExcluirProjeto | Exclui projeto |
| POST | `/listar` | ListarProjetos | Lista paginada |
| POST | `/upsert` | UpsertProjeto | Inclui ou altera |
| GET | `/status` | — | Health check |

## 2. Mapeamento de Campos (projetos → Omie cadastro)

| Campo Omie | Coluna DB | Observação |
|---|---|---|
| `codigo` | `id` | UUID interno |
| `codInt` | `tipo` (ou campo auxiliar) | Código de integração — usaremos coluna dedicada (ver abaixo) |
| `nome` | `nome` | Nome do projeto |
| `inativo` | `status` → `"S"/"N"` | `status = "finalizado"` → `"S"` |
| `info.data_inc` | `created_at` | — |
| `info.data_alt` | `updated_at` | — |

**Nota**: A tabela `projetos` não tem coluna `codigo_integracao`. Será adicionada via migration (`varchar(20)`, nullable, unique) para suportar o campo `codInt` do Omie.

## 3. Migration

```sql
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS codigo_integracao varchar(20) UNIQUE;
```

## 4. Lógica por Endpoint

- **Incluir**: Requer `codInt` + `nome`. Insere com `criador_id` do service role (campo obrigatório na tabela).
- **Alterar**: Busca por `codigo` (UUID) ou `codInt`. Update parcial de `nome` e `inativo`.
- **Consultar**: Retorna cadastro completo com `info`.
- **Excluir**: Soft delete: `status = 'finalizado'`.
- **Listar**: Paginação, filtros por `nome_projeto`, `filtrar_por_data_de/ate`, `apenas_importado_api`.
- **Upsert**: Insert se não existe, update se existe (por `codInt`).

Autenticação: `validateApiKey`.

## 5. Documentação & UI

- Novo `docs/API_PROJETOS.md`
- Presets no `ApiTester.tsx`
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | Adicionar coluna `codigo_integracao` |
| `supabase/functions/projetos-api/index.ts` | Criar |
| `docs/API_PROJETOS.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

