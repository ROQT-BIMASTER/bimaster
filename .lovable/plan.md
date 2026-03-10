

## Plano: API de Exportação de Pagamentos para o ERP (modelo Pull)

### Entendimento

O usuário quer que o payload enviado ao ERP contenha apenas **dados descritivos legíveis** — sem códigos internos do sistema (ex: `payment_method` não deve ser "2" ou "pix_code", mas sim "PIX", "Transferência Bancária", etc.). O campo `payment_details` (chave PIX, dados bancários) também não deve conter códigos internos.

### O que será feito

**1. Nova Edge Function: `contas-pagar-export-api`**

Endpoint Pull (mesmo padrão do `contas-receber-api`) com autenticação via `x-api-key`:

| Rota | Descrição |
|------|-----------|
| `GET /paid` | Lista pagamentos pagos pendentes de exportação |
| `POST /confirm` | ERP confirma recebimento, marca como exportado |
| `GET /status` | Estatísticas (pendentes, exportados, total) |

**2. Payload limpo (sem códigos internos)**

Todos os campos retornados serão descritivos:

```json
{
  "id": "uuid",
  "empresa_id": 1,
  "empresa_nome": "Empresa XYZ",
  "fornecedor_nome": "Fornecedor ABC",
  "fornecedor_documento": "12.345.678/0001-90",
  "tipo_documento": "NF",
  "numero_documento": "12345",
  "valor": 1500.00,
  "data_vencimento": "2026-03-15",
  "data_pagamento": "2026-03-10",
  "metodo_pagamento": "PIX",
  "portador": "Banco Itaú",
  "departamento": "Compras",
  "descricao": "Compra de materiais",
  "status": "Pago"
}
```

Campos como `payment_details`, `source_id`, `source_type`, `code`, `rejection_*`, `receipt_*` e demais campos internos do sistema serão **excluídos** do payload — o ERP recebe apenas o que precisa para registrar a conta paga.

**3. Fluxo automático atualizado**

Quando um pagamento é marcado como pago, o registro na `erp_export_queue` continua sendo criado automaticamente. A API `/paid` filtra apenas registros com `export_status = 'pending'` (pagos mas ainda não confirmados pelo ERP). Após o ERP chamar `/confirm`, o status muda para `exported`.

**4. Documentação para a equipe do ERP**

Arquivo `docs/API_EXPORT_PAGAMENTOS.md` com instruções claras: URL, autenticação, formato do payload, exemplos de chamada e fluxo de confirmação.

### Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/contas-pagar-export-api/index.ts` | Criar |
| `supabase/config.toml` | Registrar função |
| `docs/API_EXPORT_PAGAMENTOS.md` | Criar documentação |
| `supabase/functions/erp-export-payment/index.ts` | Ajustar payload (remover códigos internos) |

### Segurança

- Autenticação via `x-api-key` (secret `CONTAS_PAGAR_EXPORT_API_KEY`)
- Sem exposição de dados internos do sistema no payload
- Log de consultas para auditoria

