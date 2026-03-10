

## Plano: Envio de Pagamentos para o ERP

### Status: ✅ Implementado

### O que foi feito

1. **Tabela `erp_export_queue`** — Criada com RLS restrita via `can_access_payment_queue`
2. **Edge Function `erp-export-payment`** — 3 canais: N8N webhook, REST API, SQL Direct (placeholder)
3. **Trigger automático** — Ao marcar como pago no `useFinancialPaymentQueue`, exporta automaticamente
4. **Badge visual** — `ErpExportStatusBadge` no `PaymentReviewDialog` com status e botão reenviar
5. **Helper `useErpExport.ts`** — Função reutilizável para exportar pagamentos

### Secrets necessárias (conforme canal)
- `N8N_ERP_EXPORT_WEBHOOK_URL` — para canal N8N
- `ERP_REST_API_URL` + `ERP_REST_API_KEY` — para canal REST API
- `ERP_SQL_HOST` — para canal SQL Direct (não implementado ainda)
