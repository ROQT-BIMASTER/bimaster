

## Envio de Pagamentos para o ERP — Plano de Implementação

### Contexto

Quando um item da **Central de Pagamentos** (`financial_payment_queue`) é marcado como "Pago", os dados do pagamento (fornecedor, valor, método, data) precisam ser enviados ao ERP SQL Server para inclusão como conta paga. Hoje o fluxo termina no banco local — não há retorno ao ERP.

### Arquitetura Proposta

Criar um sistema flexível com **3 canais de envio** (configuráveis pelo admin) + trigger automático ao marcar como pago + reenvio manual.

```text
┌─────────────────────────┐
│  Marcar como Pago       │
│  (PaymentReviewDialog)  │
└──────────┬──────────────┘
           │ financial_status = 'paid'
           ▼
┌─────────────────────────┐
│  Hook: updateStatus     │
│  + enviarParaERP()      │◄── Automático
└──────────┬──────────────┘
           │
     ┌─────┼──────┐
     ▼     ▼      ▼
   N8N   SQL    REST
  Webhook Server  API
     │     │      │
     └─────┴──────┘
           ▼
┌─────────────────────────┐
│  erp_export_queue       │  ← Tabela de controle
│  (status, tentativas,   │
│   erro, canal usado)    │
└─────────────────────────┘
```

### 1. Nova tabela: `erp_export_queue`

Controla o envio de cada pagamento ao ERP com rastreabilidade.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | |
| `payment_queue_id` | uuid FK → financial_payment_queue | |
| `export_channel` | text | `'n8n'`, `'sql_direct'`, `'rest_api'` |
| `export_status` | text | `'pending'`, `'sent'`, `'success'`, `'error'` |
| `payload` | jsonb | Dados enviados ao ERP |
| `response` | jsonb | Resposta do ERP |
| `attempts` | int | Contagem de tentativas |
| `last_attempt_at` | timestamptz | |
| `error_message` | text | |
| `created_at` / `exported_at` | timestamptz | |
| `created_by` | uuid | |

RLS: apenas usuários com permissão ao módulo financeiro.

### 2. Edge Function: `erp-export-payment`

Recebe o `payment_queue_id` e o `channel` configurado, monta o payload com os campos do ERP (fornecedor, documento, valor, data pagamento, método, status=Pago) e envia por um dos 3 canais:

- **N8N**: POST para webhook N8N configurado (secret `N8N_ERP_EXPORT_WEBHOOK_URL`)
- **SQL Direct**: Conexão SQL Server via secret existente (reutiliza padrão do `contas-pagar-api`)
- **REST API**: POST para endpoint REST do ERP (secret `ERP_REST_API_URL` + `ERP_REST_API_KEY`)

Registra resultado na `erp_export_queue`.

### 3. Alterações no frontend

**`useFinancialPaymentQueue.ts`** — No `onSuccess` do `updateStatusMutation`, quando `financial_status === 'paid'`, chamar a edge function `erp-export-payment` automaticamente.

**`PaymentReviewDialog.tsx`** — Adicionar indicador visual do status de envio ao ERP (badge: "Enviado ao ERP", "Erro no envio", "Pendente"). Botão "Reenviar ao ERP" para itens com erro.

**Configurações** — Tela simples em Settings para escolher o canal ativo (N8N / SQL / REST) e configurar as URLs/credenciais necessárias.

### 4. Payload para o ERP

```json
{
  "empresa_id": 1,
  "fornecedor_nome": "Fornecedor XYZ",
  "fornecedor_documento": "12.345.678/0001-90",
  "tipo_documento": "NF",
  "numero_documento": "12345",
  "valor": 1500.00,
  "data_vencimento": "2026-03-15",
  "data_pagamento": "2026-03-10",
  "metodo_pagamento": "PIX",
  "detalhes_pagamento": { "chave_pix": "..." },
  "status": "Pago",
  "observacoes": "...",
  "codigo_origem": "PAG-2026-0001"
}
```

### 5. Arquivos a criar/alterar

| Arquivo | Ação |
|---|---|
| **Migration SQL** | Criar tabela `erp_export_queue` com RLS |
| `supabase/functions/erp-export-payment/index.ts` | Nova edge function com 3 canais |
| `src/hooks/useFinancialPaymentQueue.ts` | Trigger automático pós-pagamento |
| `src/components/financeiro/payments/PaymentReviewDialog.tsx` | Badge ERP + botão reenvio |
| `src/components/financeiro/payments/ErpExportStatusBadge.tsx` | Novo componente de status |
| `supabase/config.toml` | Registro da nova function |

### Segurança

- Edge function valida JWT do usuário
- Secrets para URLs/credenciais do ERP armazenadas via Lovable Cloud
- RLS na `erp_export_queue` restrita a usuários do módulo financeiro
- Auditoria completa: cada tentativa registrada com payload e resposta

