

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

---

## Plano: API de Exportação Pull para o ERP

### Status: ✅ Implementado

### O que foi feito

1. **Edge Function `contas-pagar-export-api`** — API Pull com 3 endpoints:
   - `GET /paid` — Lista pagamentos pagos pendentes de exportação (payload limpo, sem códigos internos)
   - `POST /confirm` — ERP confirma recebimento dos pagamentos
   - `GET /status` — Estatísticas de sincronização
2. **Payload limpo** — Métodos de pagamento mapeados para nomes legíveis (PIX, TED, Boleto, etc.)
3. **Autenticação via `x-api-key`** — Usa secret `EXPORT_API_KEY` já existente
4. **Documentação** — `docs/API_EXPORT_PAGAMENTOS.md` com exemplos completos para a equipe do ERP
5. **erp-export-payment atualizado** — Payload sem códigos internos (`payment_details`, `code` removidos)
