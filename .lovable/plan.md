

## Plano: Tarefas Financeiras com Método de Pagamento (PIX, Boleto, TED...)

### Objetivo
Quando o financeiro clicar em **"Marcar como Pago"**, abrir um dialog intermediário (similar ao `AlterarCustoDialog` da fábrica) onde ele seleciona o **método de pagamento** e preenche campos específicos daquele método antes de confirmar.

### 1. Migração de Banco de Dados
Adicionar coluna `payment_method` na tabela `financial_payment_queue`:

```sql
ALTER TABLE public.financial_payment_queue 
ADD COLUMN payment_method text,
ADD COLUMN payment_details jsonb DEFAULT '{}';
```

- `payment_method`: PIX, Boleto, TED, DOC, Débito Automático, Cartão
- `payment_details`: JSON com campos específicos (chave PIX, comprovante, etc.)

### 2. Novo Componente: `MarcarPagoDialog`
Criar `src/components/financeiro/payments/MarcarPagoDialog.tsx`:

- **Select** com métodos de pagamento predefinidos
- **Campos condicionais** por método:
  - **PIX**: Chave PIX (tipo + valor), ID da transação
  - **Boleto**: Linha digitável, data de pagamento
  - **TED/DOC**: Banco destino, agência, conta, ID da transação
  - **Débito Automático**: Referência
  - **Cartão**: Últimos 4 dígitos, bandeira
- Campo de **observações** (textarea)
- Resumo do pagamento (fornecedor, valor, vencimento) no topo — similar ao card de resumo do `AlterarCustoDialog`

### 3. Integração no `PaymentReviewDialog`
- O botão **"Marcar como Pago"** deixa de chamar `handleAction('paid')` diretamente
- Passa a abrir o `MarcarPagoDialog`
- O dialog coleta método + detalhes e chama `onMarkPaid` com os dados extras

### 4. Atualização do `handleMarkPaid`
Em `FinancialPaymentCentral.tsx`, o handler passará `payment_method` e `payment_details` junto com o update de status para `paid`.

### 5. Exibição dos Dados
No `PaymentReviewDialog`, quando o item já estiver pago, exibir um card com o método de pagamento e os detalhes preenchidos (chave PIX, ID transação, etc.).

