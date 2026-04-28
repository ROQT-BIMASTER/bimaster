# Engine de Estoque ERP — SQL Server direto

Replicar o padrão das engines de Contas a Receber/Pagar/Vendas para a view `Cust_EstoqueDistribuidora` do SQL Server do cliente, com painel de sync, histórico e tela de análise de estoque.

## Antes de começar — 2 perguntas rápidas

1. **Nome da view/tabela exata no SQL Server** — confirmar `Cust_EstoqueDistribuidora` (vista no print) ou outro nome.
2. **Chave única do registro** — precisamos confirmar se a chave de upsert é `(Empresa_Par, Cod Produto)` ou se há um campo `ID`/Lote. Pelo print, parece ser composta `Empresa_Par + Cod Produto`.

(Se preferir, sigo com `Empresa_Par + Cod Produto` como chave composta e `Cust_EstoqueDistribuidora` como nome — confirme para implementar.)

## Escopo

### 1. Banco — nova tabela `erp_estoque_distribuidora`
Espelhar as colunas vistas no print + campos de auditoria:
- `id` uuid PK
- `erp_id` text único — composto `${empresa_par}-${cod_produto}` (chave de upsert)
- `empresa_par` int, `abrev_par` text, `cod_produto` int, `nome_prod` text
- demais colunas que vierem da view (saldo, custo, validade, lote, localização etc. — coletadas no primeiro `preview-table`)
- `synced_at` timestamptz, `created_at`, `updated_at`
- RLS: somente admins/financeiro (mesmo padrão de `contas_receber`)
- Índices: `(empresa_par, cod_produto)`, `(synced_at)`

### 2. Engine — adicionar rotas em `supabase/functions/erp-sync-engine/index.ts`
Reusar `handleSyncPaginated`, `executeSqlQuery`, `batchUpsert` já existentes.

Novas rotas:
- `POST /preview-estoque` — `SELECT TOP 10` para mapear colunas reais
- `POST /sync-estoque-full` — orquestra por `Empresa_Par` (igual a contas-receber-full)
- `POST /sync-estoque-por-empresa` — paginado por empresa
- `POST /sync-estoque-incremental` — janela ±2h baseada em `synced_at` (estoque pode não ter timestamp na fonte; nesse caso, o "incremental" será um full rápido agendado)

Adicionar `transformEstoque(row)` que normaliza a linha SQL → schema da tabela.

### 3. Hook React — `src/hooks/useEstoqueErpSync.ts`
Clone enxuto de `useContasReceberSync.ts`:
- `fetchStats`, `fetchSyncHistory`, `testErpConnection`
- `syncFull`, `syncIncremental`, `syncByEmpresa`
- `syncProgress`, `lastSyncResult`

### 4. UI — painel `EstoqueErpSyncPanel` + página
- `src/components/financeiro/EstoqueErpSyncPanel.tsx` — espelho do `ContasReceberSyncPanel` (cards de KPI: total SKUs, distribuidoras ativas, última sync, valor total estimado)
- `src/pages/estoque/EstoqueErpSyncPage.tsx` com 3 abas: **ERP Engine | Métricas | Monitor** (reaproveita `SyncMetricsDashboard` e `SyncMonitorPanel`)
- Rota: `/dashboard/estoque/sync-erp`

### 5. Tela de Análise de Estoque
Nova página `src/pages/estoque/AnaliseEstoqueErp.tsx`:
- Filtros: Distribuidora (`Abrev_Par`), Produto, faixa de saldo
- KPIs: total SKUs, SKUs com saldo zerado, valor total inventário, top 10 distribuidoras por volume
- Tabela virtualizada (usar `VirtualizedTable` existente) com export CSV
- Gráficos com Recharts: distribuição por distribuidora, top 20 produtos por saldo
- Rota: `/dashboard/estoque/analise-erp`

### 6. Navegação
Adicionar entradas no menu Financeiro/Estoque para as duas novas páginas e indexar no Command Palette.

## Detalhes técnicos

- Reutiliza 100% da infra existente: `connectToSqlServer`, `SQL_PAGE_SIZE`, `batchUpsert` com retry de deadlock, `recordSync`, time-guard de 110s.
- Logs de sync gravados em `sync_logs` com `entidade='estoque'` (mesma tabela usada por `contas_receber`).
- Sync diária agendada via cron (opcional, segunda fase).
- Como o estoque é apenas leitura ERP→Lovable, **nenhuma rota de export/escrita** será criada — somente engine de ingestão.
- RLS estilo "admin financeiro" (mesma policy de `contas_receber`).

## Fora de escopo (não vou fazer agora)
- Movimentações/baixas no ERP (read-only)
- Integração com `estoque_distribuidoras` legado (tabelas locais permanecem; nova tabela é espelho fiel do ERP)
- Conciliação ERP × estoque interno (pode virar fase 2)

## Entregáveis
1 migration SQL, 1 edge function atualizada (3 rotas novas), 1 hook, 2 páginas (Sync + Análise), 1 painel.
