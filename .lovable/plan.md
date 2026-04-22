

# Mapa de Inventário do Módulo Contas a Pagar (AP)

Mapeamento read-only das estruturas existentes. **Sem alterações** — este é um relatório de descoberta para servir de base a próximas implementações.

## 1. Tipos & Interfaces

| Item | Localização | Observação |
|---|---|---|
| `interface ContaPagar` | `src/pages/ContasAPagar.tsx:43` | Interface principal (28 campos: empresa, fornecedor, valores, datas, classificação) |
| `interface ContaPagar` (variante grid) | `src/components/financeiro/CalendarioVencimentos.tsx:22`, `ContasPagarDREView.tsx:35` | Versões reduzidas — candidatas a unificação |
| `interface ContaPagar` (edge) | `supabase/functions/classificar-contas-pagar-ia/index.ts:5` | Espelho backend |
| `interface ContaPagarRelacionados` | `src/components/erp/SdkDownloadButtons.tsx:328` | Empresa/fornecedor agregados (anti-N+1) |
| `enum StatusTitulo` | `src/components/erp/SdkDownloadButtons.tsx:268` | TS: `PENDENTE \| PAGO \| VENCIDO \| CANCELADO` |
| `Object.freeze({StatusTitulo})` | mesmo arquivo, linha 1917 | Versão JS publicada via SDK |
| `class StatusTitulo(str, Enum)` | mesmo arquivo, linha 3004 | Versão Python publicada via SDK |
| `interface ProcessTipoDocumento` | `src/hooks/useProcessTiposDocumento.ts:6` | Para tipos de documento (NF, BOLETO etc.) |
| Schemas Zod (`IncluirSchema`, `UpsertSchema`, `LancarPagamentoSchema`, `EstornarSchema`, `QueryParamsSchema`) | `supabase/functions/_shared/contas-pagar/types.ts` | Validação backend estrita |

**Lacuna:** não existe `interface TituloAP` — o nome canônico é `ContaPagar`. Não há tipo unificado em `src/types/`; cada tela redeclara.

## 2. Componentes React do Módulo AP

**Telas (em `src/pages/`)**
- `ContasAPagar.tsx` (1862 linhas — tela master)
- `ContaPagarDetalhe.tsx`
- `ContasPagarAuditoria.tsx`
- `ContasPagarGestao.tsx` (redirect legacy)
- `financeiro/CadastroTituloAP.tsx`
- `financeiro/PainelCentralAP.tsx`
- `financeiro/FilaExportacaoERP.tsx`
- `financeiro/SyncCadastrosAP.tsx`
- `financeiro/ConciliacaoManualAP.tsx`
- `financeiro/ContasPagarSyncPage.tsx`
- `financeiro/RelatorioAPxERP.tsx`

**Componentes (em `src/components/financeiro/`)**
- `DashboardContasPagar.tsx` · `ContasPagarDREView.tsx` · `ContasPagarTabContent.tsx`
- `CalendarioVencimentos.tsx` · `DetalheLancamentoDialog.tsx` · `EditarClassificacaoRapidaDialog.tsx`
- `ContasPagarSyncPanel.tsx` · `SyncMonitorPanel.tsx` · `SyncMetricsDashboard.tsx`
- `ContasPagarAIChat.tsx` · `SofiaFloatingChat.tsx`

**Subpasta `financeiro/ap/`**
- `ErpStatusSection.tsx` · `ErpSyncStatusInline.tsx` · `IACategorySuggestion.tsx` · `PostPaymentErpPrompt.tsx`

**Subpasta `financeiro/payments/` (fila SaaS)**
- `PaymentQueueTable.tsx` · `PaymentQueueKPIs.tsx` · `PaymentReviewDialog.tsx`
- `MarcarPagoDialog.tsx` · `PaymentChatPanel.tsx` · `PaymentChatConsolidado.tsx`
- `RejeicaoFinanceiraDialog.tsx` · `QuickDueDateChange.tsx` · `ReceiptUploadSection.tsx`
- `PaymentBankPrintSummary.tsx` · `SupplierDetailsCard.tsx` · `SupplierPaymentHistory.tsx`
- `SupplierPaymentExceptionsTab.tsx` · `CorrectionRulesTab.tsx`
- `PaymentPolicyBanner.tsx` · `PaymentPolicyConfigDialog.tsx` · `ErpExportStatusBadge.tsx`
- `AttachmentAcknowledgement.tsx` · `DocumentAuditCard.tsx`

**Reutilizáveis (shadcn/ui em `src/components/ui/`):** `Card`, `Dialog`, `Table`, `Tabs`, `Badge`, `Button`, `Input`, `Select`, `Checkbox`, `Popover`. Padrão `DecimalInput` (4 casas) para valores.

**Layout:** `src/components/dashboard/DashboardLayout.tsx` (wrapper obrigatório de toda página AP).

## 3. Hooks & Serviços

**Hooks específicos AP/Financeiro**
- `useContasPagarSync` (`src/hooks/useContasPagarSync.ts`) — orquestra sync N8N/Direct, expõe `SyncResult`, `SyncHistory`, `ContasPagarStats`, `SyncMode`, `ErpCredentials`
- `useFinancialPaymentQueue` · `useFinancialPaymentPolicies` · `useFinancialStatus` · `useFinancialCorrectionRules` · `useFinancialSubmission`
- `useExpenseAI` · `useExpenseFinancialStatus` · `usePaymentMessages` · `usePaymentQueueHistory`
- `useSupplierPaymentExceptions` · `useDocumentAudit` · `useErpExport`
- `useEmpresaFilter` · `useUserEmpresas` · `useDashboardKPIs`

**Hooks genéricos em uso**
- `useSupabaseQuery` (`src/hooks/useSupabaseQuery.ts`) — wrapper React Query + retry exponencial
- `usePaginatedQuery` · `useMutationWithTimeout`
- React Query (`@tanstack/react-query`) com `staleTime=5min` / `gcTime=10min`

**Não há `useContasPagar` nem `useAPI` genéricos** — telas usam `useQuery` direto + `callApi`.

**Utilitários de formatação** (`src/lib/formatters.ts`)
- `formatCurrency(value, showCents)` — pt-BR / BRL (uso preferencial)
- `formatCurrencySmart` / `formatCurrencyCompact` — sufixo M/K para dashboards
- `formatNumber` · `formatPercentage`
- `formatDate(d, 'short'|'long'|'full')` · `formatDateTime` · `formatRelativeTime`
- `formatCPF` · `formatCNPJ` · `formatPhone` · `formatCEP`
- `formatBytes` · `formatDuration` · `truncate` · `capitalize`

**Utilitários de data** (`src/utils/dateUtils.ts`): `parseLocalDate`, `getDateKey`, `formatLocalDate` — fixados em `America/Sao_Paulo`.

**Helpers AP em `src/lib/utils/api-helpers.ts`:** `formatBRL`, `fmtDate`, `fmtDateTime`, `dateToApi` (usados pela camada `callApi`).

**Aviso:** convivem `formatCurrency` (canônico) e `formatBRL`/`formatarMoeda` locais em ~165 arquivos — fragmentação reconhecida; padrão futuro é `formatCurrency`.

## 4. Rotas & Navegação

Padrão URL: **`/dashboard/financeiro/contas-a-pagar`** (todas as rotas em `src/App.tsx`).

| Rota | Tela |
|---|---|
| `/dashboard/financeiro/contas-a-pagar` | `ContasAPagar` (master) |
| `/dashboard/financeiro/contas-a-pagar/:id` | `ContaPagarDetalhe` |
| `/dashboard/financeiro/contas-a-pagar/novo` | `CadastroTituloAP` |
| `/dashboard/financeiro/contas-a-pagar/:id/editar` | `CadastroTituloAP` |
| `/dashboard/financeiro/contas-a-pagar/auditoria` | `ContasPagarAuditoria` |
| `/dashboard/financeiro/contas-a-pagar/sync` | `ContasPagarSyncPage` (admin) |
| `/dashboard/financeiro/contas-a-pagar/exportacao-erp` | `FilaExportacaoERP` (admin) |
| `/dashboard/financeiro/contas-a-pagar/sync-cadastros` | `SyncCadastrosAP` (admin) |
| `/dashboard/financeiro/contas-a-pagar/conciliacao` | `ConciliacaoManualAP` (admin) |
| `/dashboard/financeiro/ap-central` | `PainelCentralAP` (admin) |
| `/configuracoes/admin/relatorio-ap-erp` | `RelatorioAPxERP` (admin) |
| `/dashboard/contas-a-pagar` *(legacy)* | redirect → rota nova |
| `/dashboard/contas-pagar` *(legacy)* | `ContasPagarGestao` (Navigate redirect) |

Guards: `<ModuleRoute moduleCode="financeiro">` + `<ScreenProtectedRoute screenCode="financeiro_contas_pagar">`. Telas administrativas usam `<ScreenRoute screenCode="admin">`.

## 5. Estado Global

- **Server state:** React Query (`@tanstack/react-query`) — fonte primária de cache. QueryClient global com `staleTime=5min`, `gcTime=10min`, `refetchOnWindowFocus=true`.
- **Auth/session:** Supabase client (`src/integrations/supabase/client.ts`) com `localStorage` + `autoRefreshToken`. Sessão única no app inteiro.
- **Realtime:** canal Supabase Realtime (10 eventos/s).
- **UI state local:** `useState`/`useReducer` por tela. Sem Redux, Zustand ou Context global de domínio.
- **Permissões:** `useUserRole`, `useUIPermissions`, `useEmpresaFilter` (filtro multi-empresa do contexto do usuário).
- **Offline/PWA:** `useOfflineStatus`, `useSyncOfflineData`, `useOnlineStatus`, `usePWA`.

## 6. Configuração de API

**Cliente HTTP**: `fetch` nativo (sem axios). Centralizado em `src/lib/utils/api-helpers.ts`.

- **`callApi(fn, body)`** — wrapper único para Edge Functions:
  - extrai `path` do body, resolve método via `METHOD_MAP` (`/listar`, `/query`, `/consultar`, `/parcelas`, `/pagamentos`, `/anexos`, `/stats`, `/last-sync`, `/status`, `/chunks-progress` = GET; `/alterar`, `/update` = PUT; `/excluir` = DELETE; demais = POST)
  - injeta `Authorization: Bearer <session.access_token>`, `apikey: VITE_SUPABASE_PUBLISHABLE_KEY` e `X-Idempotency-Key: crypto.randomUUID()` em escritas
  - tratamento padronizado de 401 (toast "sessão expirada"), 429 (Retry-After), 500
  - log automático de `request_id` + `duration_ms`
- **`callExportApi(path, method, body)`** — variante para `contas-pagar-export-api`
- **`getAuthHeaders()`** (`src/lib/utils/auth-headers.ts`) — usado por chamadas custom

**Variáveis de ambiente** (auto-injetadas pelo Lovable, jamais editadas manualmente):
- `VITE_SUPABASE_URL` (baseURL das edge functions)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (apikey)
- `VITE_SUPABASE_PROJECT_ID`

**Segurança das Edge Functions**: wrapper `secureHandler` em `_shared/secureHandler.ts` aplica WAF + Zod + idempotência + audit log para todas as rotas AP.

**Endpoints AP atualmente consumidos** (Edge Function `contas-pagar-api`):
`/query`, `/consultar`, `/listar`, `/incluir`, `/upsert`, `/upsert-lote`, `/alterar`, `/update`, `/excluir`, `/lancar-pagamento`, `/cancelar-pagamento`, `/cancelar`, `/registrar-pagamento`, `/estornar`, `/parcelas`, `/parcelas/sync`, `/pagamentos`, `/anexos`, `/conciliar`, `/desconciliar`, `/sync`, `/status`, `/health`, `/stats`, `/last-sync`, `/chunks-progress`.

Edge Function complementar: `tipos-documento-api` (`/consultar`, `/pesquisar`, `/status`).

## 7. Lacunas & Recomendações (sem ação automática)

1. **Tipo único `ContaPagar`**: três interfaces redundantes (`ContasAPagar.tsx`, `CalendarioVencimentos.tsx`, `ContasPagarDREView.tsx`). Consolidar em `src/types/financeiro/contas-pagar.ts` reduz drift.
2. **Hook `useContasPagar`**: ausente. Hoje cada tela monta `useQuery` + `callApi` na mão; um hook canônico (`list`, `byId`, `create`, `update`, `pay`, `reverse`) eliminaria 200+ linhas duplicadas.
3. **Formatação**: convergir `formatBRL`, `formatarMoeda`, locais ad-hoc → `formatCurrency` de `src/lib/formatters.ts`.
4. **Convenção de URL**: já uniforme em `/dashboard/financeiro/contas-a-pagar/*`. Manter.

## Próximos passos sugeridos (carecem de aprovação)

- Gerar `src/types/financeiro/contas-pagar.ts` com `ContaPagar`, `Pagamento`, `Parcela`, `StatusTitulo`, `TipoDocumento` exportados (single source of truth).
- Criar `src/hooks/useContasPagar.ts` agregando `useList`, `useById`, `usePay`, `useCancel`, `useReverse` em cima de `callApi`.
- Refatorar `ContasAPagar.tsx`, `CalendarioVencimentos.tsx`, `ContasPagarDREView.tsx` para importar o tipo único.

Apenas mediante aprovação explícita.

