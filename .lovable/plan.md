## Objetivo

Criar um pipeline de sincronização para a tabela `ConsultaPowerBI` (Vendas/Faturamento) do SQL Server espelhando exatamente o padrão já consolidado em Contas a Receber e Contas a Pagar:

1. Carga inicial filtrada a partir de **01/01/2025**.
2. Sincronização **incremental diária automática** (cron) capturando novos faturamentos.
3. Frontend **somente consulta** — nenhuma mutação a partir da UI.

## Inventário (já existente, será reutilizado)

- Tabela destino: `public."Union"` (1.041.000 registros, 2022→2026, com RLS, índices em `id_empresa`, `nota`, `pedido`, `data`, `cod_cliente`, `cod_produto`, `cod_vend` e `operacao`).
- View: `public.vendas_union` (proxy read-only consumida por `useDetalhamentoVendas`, `useClientesDashboard`, `useGeograficoDashboard`, `useProdutosDashboard`, `PainelExecutivo`, `PerformanceVendas`).
- Edge function host: `supabase/functions/erp-sync-engine/index.ts` (mesmo motor de CR/CP, conexão tedious SQL Server, paginação 3000/lote, deadlock-retry, time-guard 110s, registro em `sync_control` + `sync_metrics`).
- Painel/Hook UI: `ContasPagarSyncPanel.tsx`, `useContasPagarSync.ts`, `ContasPagarSyncPage.tsx` (template a clonar).

## Mudanças

### 1. Backend — Estender `erp-sync-engine`

Adicionar três novas rotas ao router e funções equivalentes às de CR/CP:

- `sync-vendas-por-empresa` — filtro `[ID Empresa] = X AND [Data] >= '2025-01-01'`.
- `sync-vendas-full` — orquestração por empresa (busca DISTINCT `[ID Empresa]` em `ConsultaPowerBI`, dispara `por-empresa` em concorrência 2). Janela: `[Data] >= '2025-01-01'`.
- `sync-vendas-incremental` — janela móvel: novos lançamentos com `[Data] >= últimaSync − 2 dias` (cobre lançamentos retroativos e fuso). Se não houver `last_sync`, fallback `[Data] >= GETDATE() - 7 dias`.

Implementação:

- Reutilizar `handleSyncPaginated()` (já genérico — recebe `viewName`, `tableName`, `entityName`, `transformFn`, `conflictCol`, `whereClause`).
- Novo transformer `transformVendas(row)` que mapeia colunas SQL Server → colunas Postgres (`ID Empresa`→`id_empresa`, `Empresa`→`empresa`, `Pedido`→`pedido`, `Data`→`data`, `Nota`→`nota`, `Operacao`→`operacao`, `Cod Cliente`→`cod_cliente`, `Cliente`→`cliente`, `ID Ramo`→`id_ramo`, `Ramo`→`ramo`, `Cidade`→`cidade`, `UF`→`uf`, `Tp Venda`→`tp_venda`, `Tp NFe`→`tp_nfe`, `Cod Produto`→`cod_produto`, `Descricao`→`descricao`, `Marca`→`marca`, `Quantidade`→`quantidade`, `Preco Venda`→`preco_venda`, `Vl Desconto`→`vl_desconto`, `Vl ICM Subst`→`vl_icm_subst`, `Vl CMV`→`vl_cmv`, `Vl Outros Custos`→`vl_outros_custos`, `Tabela`→`tabela`, `Cod Vend`→`cod_vend`, `Vendedor`→`vendedor`, `Cod Equipe`→`cod_equipe`, `Nome Equipe`→`nome_equipe`, `Supervisor`→`supervisor`, `Nome Linha`→`nome_linha`). Calcula `venda = quantidade * preco_venda - vl_desconto`.
- Chave de conflito (upsert): coluna `erp_id` derivada de `${id_empresa}-${nota}-${pedido}-${cod_produto}` (a tabela `Union` precisará de uma coluna `erp_id text UNIQUE` — ver migração).
- Atualizar `case` de roteamento e listagem de endpoints em `status`.

### 2. Banco de dados — Migração

- Adicionar coluna `erp_id text` em `public."Union"` com índice único.
- Backfill `erp_id` para registros existentes via `UPDATE` concatenando os campos.
- Adicionar coluna `sincronizado_em timestamptz` (paridade com CR/CP).
- Confirmar RLS: já está em `admin_vendas_full_access` + `empresa_vendas_access` (SELECT). Garantir que **não há** policies de INSERT/UPDATE/DELETE para roles autenticados — apenas service_role (usada pela edge function) escreve. Sem quebra de zero-public-exposure.

### 3. Cron diário (pg_cron + pg_net)

Agendar via `supabase--insert` (não migration — contém URL e chave do projeto):

- Job `sync-vendas-incremental-diario` — todos os dias às 06:15 BRT (`15 9 * * *` UTC).
- Chama `POST /functions/v1/erp-sync-engine` com `{"path":"sync-vendas-incremental"}`.

### 4. Frontend — UI somente consulta

Clonar 1:1 o padrão de Contas a Pagar:

- `src/hooks/useVendasSync.ts` — três actions (`syncFull`, `syncIncremental`, `syncByEmpresa`) via `supabase.functions.invoke('erp-sync-engine', { body: { path: 'sync-vendas-...' } })`. Stats em tempo real lendo `public."Union"` (count total, último `sincronizado_em`, contagem por mês corrente, contagem por empresa).
- `src/components/financeiro/VendasSyncPanel.tsx` — quatro cards: Total de Notas, Faturamento do Mês (R$), Última Sync, Empresas. Botões: Sync Incremental, Sync Full, Sync por Empresa. Progresso live.
- `src/pages/financeiro/VendasSyncPage.tsx` — três tabs idênticas: ERP Engine, Métricas (`SyncMetricsDashboard` reutilizado, filtrando entidade `vendas`), Monitor (`SyncMonitorPanel` reutilizado).
- Roteamento: registrar `/dashboard/financeiro/vendas-sync` em `App.tsx` (admin-only via `RequireRole`, alinhado a [Admin AP Screens](mem://security/admin-only-ap-governance-screens)).
- Adicionar entrada na sidebar (mesmo grupo de "Sync Contas a Receber/Pagar").
- **Garantia read-only**: nenhum hook de mutation sobre `Union`/`vendas_union` será criado. As telas existentes (`PerformanceVendas`, `PainelExecutivo`, dashboards) continuam apenas consumindo a view.

### 5. Versionamento e changelog

- Bump `APP_VERSION` para `3.3.0` em `src/components/erp/ApiDocumentation.tsx`.
- Entrada de changelog grep-verificável citando: 3 novos endpoints (`sync-vendas-full`, `sync-vendas-incremental`, `sync-vendas-por-empresa`), tabela alvo `Union`, cron diário, modo read-only no frontend (conforme [Release Changelog Discipline](mem://process/release-changelog-discipline)).

## Detalhes técnicos

### Filtro de janela inicial (≥ 2025)

Aplicado no `whereClause` SQL Server da carga full e por-empresa:
```sql
[Data] >= '2025-01-01' AND [ID Empresa] = X
```

### Filtro incremental

```sql
[Data] >= 'YYYY-MM-DD HH:MM:SS'  -- last_sync menos 2 dias
```
Ou fallback `[Data] >= DATEADD(DAY, -7, GETDATE())` no primeiro disparo.

### Estimativa de volume

- Histórico ≥ 2025: ~600k linhas (estimativa proporcional aos 1.041k existentes desde 2022). 
- Paginação 3000/req × 2 empresas em paralelo com time-guard 110s → carga full em ~30–45 min total, dividida em chamadas reentrantes (mesmo padrão de CR/CP que processa 6700+ títulos).
- Incremental diário: poucos milhares de linhas/dia → roda em <30s.

### Garantia "somente consulta" no frontend

- Migração mantém `Union` sem policies de WRITE para roles autenticados — apenas `service_role` (edge function) grava.
- Nenhum hook em `src/hooks/` chamará `.insert`/`.update`/`.delete`/`.upsert` em `Union` ou `vendas_union`.
- Auditável via:
  ```
  rg "from\(['\"](Union|vendas_union)['\"]\)\.(insert|update|delete|upsert)" src/
  ```
  Esperado: zero matches.

## Arquivos afetados

**Editados:**
- `supabase/functions/erp-sync-engine/index.ts` (+~180 linhas: transformer + 3 handlers + 3 cases no router + atualização da listagem de endpoints).
- `src/components/erp/ApiDocumentation.tsx` (changelog + APP_VERSION).
- `src/App.tsx` (rota nova).
- Sidebar de financeiro (link novo).

**Criados:**
- `src/hooks/useVendasSync.ts`.
- `src/components/financeiro/VendasSyncPanel.tsx`.
- `src/pages/financeiro/VendasSyncPage.tsx`.

**Migração:** ALTER TABLE `Union` adicionando `erp_id` e `sincronizado_em`, índice único em `erp_id`, backfill.

**Cron (via supabase--insert):** job `sync-vendas-incremental-diario`.

## Validação pós-implementação

1. Testar `POST /erp-sync-engine` com `{"path":"sync-vendas-por-empresa","empresa_id":1}` e verificar `sync_control` + count em `Union`.
2. Disparar `sync-vendas-full` e acompanhar pelo painel.
3. Confirmar cron registrado em `cron.job`.
4. Greps de invariante: zero mutations sobre `Union` no frontend.
