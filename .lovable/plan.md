## Objetivo

Criar uma nova conexão Sync (igual ao padrão do Estoque) para a tabela **ComposicaoProduto** do SQL Server, replicando-a em uma nova tabela `erp_composicao_produto` no banco Lovable Cloud, com tela dedicada em `/dashboard/composicao/sync`.

## 1. Banco — nova tabela `erp_composicao_produto`

Migration cria a tabela espelho com todas as colunas da view (preservando o `raw` JSONB para garantir totalidade dos dados, igual fizemos no estoque):

Colunas estruturadas:
- `erp_id text PRIMARY KEY` — chave composta `{empresa}-{produto}-{materia}`
- `empresa_compo int NOT NULL` (Empresa_Compo)
- `produto_compo int NOT NULL` (Produto_Compo)
- `materia_compo int NOT NULL` (Materia_Compo)
- `quantidade_compo numeric(18,6)` (Quantidade_Compo)
- Demais colunas detectadas em runtime via `raw jsonb` (preserva qualquer campo extra que a view exponha — % participação, ordem, unidade etc.)
- `sincronizado_em timestamptz default now()`
- `created_at`, `updated_at`

Índices: `(empresa_compo)`, `(produto_compo)`, `(materia_compo)`, `(empresa_compo, produto_compo)`.

RLS: leitura para autenticados respeitando `user_empresas` (mesmo padrão do estoque); escrita apenas via service role (engine).

## 2. Edge Function — extensão do `erp-sync-engine`

Adicionar handlers no arquivo existente `supabase/functions/erp-sync-engine/index.ts`:

```text
COMPOSICAO_VIEW   = "ComposicaoProduto"
COMPOSICAO_TABLE  = "erp_composicao_produto"
COMPOSICAO_ORDER  = "[Empresa_Compo], [Produto_Compo], [Materia_Compo]"
```

- `transformComposicao(row)` — extrai os 4 campos tipados e armazena `row` inteira em `raw`.
- `handleSyncComposicaoPorEmpresa(req)` — paginado, `WHERE [Empresa_Compo] = N`, usa `handleSyncPaginated`.
- `handleSyncComposicaoFull(req)` — descobre `DISTINCT Empresa_Compo` e dispara um por um (CONCURRENCY=2), idêntico ao estoque.
- `handleSyncComposicaoIncremental(req)` — alias para Full (sem timestamp na view).
- Novas rotas no `switch`:
  - `sync-composicao-por-empresa`
  - `sync-composicao-full`
  - `sync-composicao-incremental`

## 3. Frontend — Sync da Composição

**Hook** `src/hooks/useComposicaoErpSync.ts` — clone enxuto de `useEstoqueErpSync` com:
- entidade `'composicao'` em `sync_control`
- stats: total registros, empresas distintas, produtos distintos, matérias distintas, última sync
- ações: `testConnection`, `testErpConnection`, `syncFull`, `syncByEmpresa`, `refreshAll`

**Página** `src/pages/composicao/ComposicaoErpSyncPage.tsx`:
- Layout idêntico ao `EstoqueErpSyncPage` (3 abas: ERP Engine / Métricas / Monitor)
- Componente novo `ComposicaoErpSyncPanel` (cópia adaptada de `EstoqueErpSyncPanel`) com:
  - card status conexão SQL Server
  - cards KPI (registros, empresas, produtos, matérias, última sync)
  - botão **Sync Completo** e seletor **Sync por Empresa**
  - histórico das últimas 10 syncs (`sync_control` filtrado por `entidade='composicao'`)
- `SyncMonitorPanel` e `SyncMetricsDashboard` reutilizados (já são genéricos).

**Rota** registrada em `src/App.tsx`: `/dashboard/composicao/sync` → `ComposicaoErpSyncPage`.

**Sidebar** (`AppSidebar.tsx`): novo item "Sync Composição" sob o módulo Composição, ícone `RefreshCw`.

## 4. Versionamento

- `APP_VERSION` → 3.4.39
- Entrada changelog em `ApiDocumentation.tsx` (PR-72): "Sync Composição (ComposicaoProduto) — engine, tabela espelho, página dedicada e RLS por empresa".

## 5. Validação após deploy

1. `test-connection` no engine.
2. `sync-composicao-por-empresa { empresa_id: 1 }` — confere upsert.
3. `sync-composicao-full` — itera todas as empresas.
4. Conferir `sync_control` (entidade=composicao) e `erp_estoque`/`erp_composicao_produto` count vs SQL Server.

## Arquivos previstos

```text
NEW supabase/migrations/<timestamp>_erp_composicao_produto.sql
EDIT supabase/functions/erp-sync-engine/index.ts          (handlers + rotas)
NEW src/hooks/useComposicaoErpSync.ts
NEW src/pages/composicao/ComposicaoErpSyncPage.tsx
NEW src/components/composicao/ComposicaoErpSyncPanel.tsx
EDIT src/App.tsx                                          (rota)
EDIT src/components/dashboard/AppSidebar.tsx              (item menu)
EDIT src/lib/version.ts                                   (3.4.39)
EDIT src/pages/ApiDocumentation.tsx                       (changelog PR-72)
```
