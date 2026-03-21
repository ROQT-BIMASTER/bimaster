

# API Categorias (CRUD) — Padronização Omie

## Resumo

Criar Edge Function `categorias-api` com 6 rotas CRUD + 1 health check. Usa tabela `trade_chart_of_accounts` existente. Precisa adicionar ~7 colunas faltantes via migration para suportar todos os campos Omie.

## 1. Migration — Expandir `trade_chart_of_accounts`

Colunas a adicionar (todas nullable, sem impacto em produção):

```sql
ALTER TABLE public.trade_chart_of_accounts
  ADD COLUMN IF NOT EXISTS descricao_padrao varchar(50),
  ADD COLUMN IF NOT EXISTS tipo_categoria varchar(3),
  ADD COLUMN IF NOT EXISTS definida_pelo_usuario varchar(1) DEFAULT 'S',
  ADD COLUMN IF NOT EXISTS id_conta_contabil integer,
  ADD COLUMN IF NOT EXISTS tag_conta_contabil varchar(20),
  ADD COLUMN IF NOT EXISTS nao_exibir varchar(1) DEFAULT 'N',
  ADD COLUMN IF NOT EXISTS transferencia varchar(1) DEFAULT 'N',
  ADD COLUMN IF NOT EXISTS codigo_dre varchar(10),
  ADD COLUMN IF NOT EXISTS codigo_integracao varchar(20) UNIQUE;
```

## 2. Nova Edge Function: `categorias-api`

| Rota | Equivalente Omie | Descrição |
|---|---|---|
| POST `/incluir` | IncluirCategoria | Inclui categoria |
| POST `/incluir-grupo` | IncluirGrupoCategoria | Inclui grupo totalizador |
| POST `/alterar` | AlterarCategoria | Altera categoria |
| POST `/alterar-grupo` | AlterarGrupoCategoria | Altera grupo |
| POST `/consultar` | ConsultarCategoria | Consulta por código |
| POST `/listar` | ListarCategorias | Lista paginada com filtros |
| GET `/status` | — | Health check |

## 3. Mapeamento de Campos

| Campo Omie | Coluna DB | Observação |
|---|---|---|
| `codigo` | `code` | Existente |
| `descricao` | `name` | Existente |
| `descricao_padrao` | `descricao_padrao` | Nova coluna |
| `tipo_categoria` | `tipo_categoria` | Nova coluna |
| `conta_inativa` | `is_active` → invertido | `is_active=true` → `conta_inativa="N"` |
| `definida_pelo_usuario` | `definida_pelo_usuario` | Nova coluna |
| `id_conta_contabil` | `id_conta_contabil` | Nova coluna |
| `tag_conta_contabil` | `tag_conta_contabil` | Nova coluna |
| `conta_despesa` | Derivado de `account_type` | `expense/cost_center` → `"S"` |
| `conta_receita` | Derivado de `account_type` | `revenue` → `"S"` |
| `nao_exibir` | `nao_exibir` | Nova coluna |
| `natureza` | `description` | Campo existente (observação/natureza) |
| `totalizadora` | `is_group` | Existente |
| `transferencia` | `transferencia` | Nova coluna |
| `codigo_dre` | `codigo_dre` | Nova coluna |
| `categoria_superior` | `parent_account_id` → busca `code` do pai | Existente (UUID → resolve para código) |
| `dadosDRE` | Derivado de `categoria_dre` + `codigo_dre` | Montado em runtime |

## 4. Lógica por Endpoint

- **IncluirCategoria**: Requer `descricao` + `tipo_categoria`. `categoria_superior` resolve para `parent_account_id`.
- **IncluirGrupoCategoria**: Cria com `is_group=true`, `tipo_grupo` define `account_type`.
- **AlterarCategoria/Grupo**: Busca por `code`. Update parcial.
- **ConsultarCategoria**: Retorna cadastro completo com `dadosDRE` sub-objeto.
- **ListarCategorias**: Paginação + filtros `filtrar_apenas_ativo` e `filtrar_por_tipo`.

Autenticação: `validateApiKey`.

## 5. Documentação & UI

- `docs/API_CATEGORIAS.md`
- Presets no `ApiTester.tsx`
- Seção no `ApiDocumentation.tsx`

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| Migration SQL | +9 colunas em `trade_chart_of_accounts` |
| `supabase/functions/categorias-api/index.ts` | Criar |
| `docs/API_CATEGORIAS.md` | Criar |
| `src/components/erp/ApiTester.tsx` | Editar — presets |
| `src/components/erp/ApiDocumentation.tsx` | Editar — seção |

