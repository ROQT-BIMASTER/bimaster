


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

---

## Plano: Fluxo Profissional de Contas a Pagar — Provisão + Baixa (Padrão SAP/TOTVS)

### Status: ✅ Implementado

### O que foi feito

1. **Migration** — Adicionada coluna `export_type` em `erp_export_queue` (`registration` | `payment`) com constraints atualizadas
2. **Edge Function `erp-export-payment`** — Payload dinâmico por tipo:
   - `registration`: status "Aguardando Pagamento", sem dados de pagamento
   - `payment`: status "Pago", com método e data de pagamento
3. **Edge Function `contas-pagar-export-api`** — Pull API expandida:
   - `GET /pending` — Itens aceitos pendentes de provisão
   - `GET /paid` — Itens pagos pendentes de baixa
   - `GET /` — Ambos, com filtro `?status=accepted,paid`
   - `POST /confirm` — Aceita `export_type` para confirmar provisão ou baixa separadamente
   - `GET /status` — Contagens separadas para provisão e baixa
4. **Hook `useErpExport.ts`** — Parâmetro `exportType` adicionado
5. **Hook `useFinancialPaymentQueue.ts`** — Triggers automáticos:
   - Ao aceitar: exporta como `registration` (provisão)
   - Ao pagar: exporta como `payment` (baixa)

### Fluxo

```text
Lançamento → Aprovação → ERP: "Aguardando Pagamento" (provisão)
                              ↓
             Pagamento → ERP: "Pago" (baixa do título)
```
