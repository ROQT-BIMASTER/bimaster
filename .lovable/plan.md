## Objetivo

Deixar a página `/dashboard/financeiro/contas-a-pagar/sync` **idêntica** à `/dashboard/financeiro/contas-a-receber/sync`, eliminando 100% das referências a N8N na UI e no hook de Contas a Pagar.

## Estado atual vs alvo

| Item | CR (alvo) | CP (atual) |
|---|---|---|
| Página com 3 abas (Engine / Métricas / Monitor) | Sim | Não — só tem 1 painel |
| Header com texto "(sem N8N)" | Sim | Diz "via N8N ou API Direta" |
| Painel chama `erp-sync-engine` | Sim | Hook chama `contas-pagar-api` |
| Botões: Sync Full / Incremental / Empresa | Sim | Botão genérico "Sincronizar Agora" |
| Aba/Tabs N8N (Webhook) | Não existe | Existe (`N8NTabContent`) |
| Cartão "Configurações Necessárias" listando secrets | Não | Sim |
| `DataSourceConfigPanel` no topo | Não | Sim |
| Histórico de sync via `sync_control` | Sim | Sim (manter) |

## Mudanças

### 1. Página `src/pages/financeiro/ContasPagarSyncPage.tsx`
Reescrever para espelhar `ContasReceberSyncPage`:
- Mesmo `DashboardLayout`, mesmas 3 abas (`Server` ERP Engine, `BarChart3` Métricas, `Activity` Monitor).
- Header: `"Sincronização com ERP"` + subtítulo `"Contas a Pagar — Engine direta SQL Server"`.
- Reaproveitar `SyncMetricsDashboard` e `SyncMonitorPanel` (ambos já mostram todas as entidades, incluindo `contas_pagar`).
- Remover botão "Voltar" (CR não tem).

### 2. Hook `src/hooks/useContasPagarSync.ts`
Reescrever espelhando `useContasReceberSync`:
- Remover: `syncMode`, `setSyncMode`, `SyncMode`, `ErpCredentials`, `syncDirect`, `fetchPreview`.
- Adicionar: `callErpEngine(path, body?)` chamando `supabase.functions.invoke('erp-sync-engine', { body: { path, ...body } })`.
- Substituir `testErpConnection` para chamar `'test-connection'` no `erp-sync-engine` (em vez de `contas-pagar-api`).
- Adicionar `syncFull()` → `'sync-contas-pagar-full'`.
- Adicionar `syncIncremental()` → `'sync-contas-pagar-incremental'`.
- Adicionar `syncByEmpresa(empresaId)` → `'sync-contas-pagar-por-empresa'` com body `{ empresa_id }`.
- Adicionar `syncProgress` (timer com `useEffect`) e `resetProgress`.
- Manter `fetchStats`, `fetchSyncHistory` (filtrados por `entidade='contas_pagar'`), `testConnection`, `refreshAll`.
- Stats: manter `pendentes`, `vencidas`, `totalValorAberto`, `totalValorPago`, `lastSync`.

### 3. Painel `src/components/financeiro/ContasPagarSyncPanel.tsx`
Reescrever espelhando `ContasReceberSyncPanel`, com adaptações específicas de CP:
- **Remover** import e uso de `N8NTabContent`, `DataSourceConfigPanel`, `Tabs`, `SyncMode`, ano mínimo, cartão "Configuração Necessária com lista de secrets".
- Header: `"Sincronização - Contas a Pagar"` + subtítulo `"Engine direta SQL Server → Banco de dados"` (sem mencionar N8N).
- 4 cards de stats: Total / Vencidas / **Total a Pagar** (ícone `Banknote`, cor laranja, usa `stats.totalValorAberto`) / Última Sync.
- Card "Motor de Sincronização (ERP → Banco)" com:
  - Linha de status SQL Server + botão "Testar ERP".
  - 3 botões: **Sync Full (Todas Empresas)**, **Sync Incremental (últimos pagamentos + vencimentos ±7 dias)**, **Sync Empresa** (Input + botão).
  - Bloco de progresso (timer ao vivo) durante sync.
  - Bloco do último resultado (`lastSyncResult`) com Total / Upserted / Mensagem ou erro.
- Card "Histórico de Sincronizações" lendo `syncHistory` (mesma tabela do CR: Data/Hora · Status · Total · Inseridos · Duração · Erro).

### 4. Limpeza de arquivos órfãos
Após a refatoração, `N8NTabContent` deixa de ser referenciado:
- **Deletar** `src/components/financeiro/N8NTabContent.tsx`.
- **Verificar e remover** quaisquer outras importações pendentes (grep por `N8NTabContent` deve ficar zero).
- Manter `DataSourceConfigPanel` intacto (pode estar sendo usado em outras telas — verificar antes de tocar).

### 5. Verificação
- `rg "[Nn]8[Nn]" src/pages/financeiro/ContasPagarSyncPage.tsx src/components/financeiro/ContasPagarSyncPanel.tsx src/hooks/useContasPagarSync.ts` → deve retornar **0 resultados**.
- Smoke test: navegar para `/dashboard/financeiro/contas-a-pagar/sync`, clicar em **Sync Incremental**, ver progresso, ver resultado, ver linha nova no histórico e nas abas Métricas/Monitor.

## Resultado visível

Página de CP indistinguível da de CR: mesmo header, mesmas 3 abas, mesmos botões (Full / Incremental / Empresa), mesmo card de progresso, mesma tabela de histórico, mesma escrita "Engine direta SQL Server". Zero menções a N8N em qualquer lugar.

## Arquivos tocados

- `src/pages/financeiro/ContasPagarSyncPage.tsx` (reescrita)
- `src/hooks/useContasPagarSync.ts` (reescrita)
- `src/components/financeiro/ContasPagarSyncPanel.tsx` (reescrita)
- `src/components/financeiro/N8NTabContent.tsx` (deletado)
