

## Plano: 3 Correções — Rejeição Financeira, Reabertura e PIX no Cadastro

### Problemas Identificados

**1. Rejeição não notifica o usuário solicitante**
No `useFinancialPaymentQueue.ts`, quando o financeiro rejeita (`updateStatusMutation`), o sistema apenas atualiza o status no banco e sincroniza com a tabela de origem via `syncStatusToSource`. Nenhuma notificação é enviada ao `requested_by`. O módulo de departamentos tem um edge function para isso (`send-department-expense-notification`), mas a Central de Pagamentos não a utiliza.

**2. Itens rejeitados não podem ser reabertos**
Não existe botão nem lógica para o financeiro (quem rejeitou) reabrir um item rejeitado e reaprová-lo. Uma vez rejeitado, o item fica travado.

**3. PIX não salva no cadastro de fornecedor (FornecedorQuickAdd)**
O código de inserção está correto sintaticamente (`pix_tipo: pixTipo || null`). O problema é que o `Select` do PIX usa `placeholder="Selecione..."` sem valor default — se o usuário digitar a chave PIX mas não selecionar o tipo, `pixTipo` permanece `""`, que vira `null`. E se selecionar o tipo mas não digitar a chave, o inverso acontece. Além disso, o `.select("id, razao_social, cnpj")` no retorno não inclui os campos PIX, então não há feedback visual de que foi salvo. Preciso verificar também se RLS na tabela base está bloqueando a escrita desses campos para o perfil do usuário.

---

### Mudanças

#### 1. Notificação de rejeição ao solicitante

**Arquivo: `src/hooks/useFinancialPaymentQueue.ts`**
- No `updateStatusMutation.onSuccess`, quando `financial_status === 'rejected'`:
  - Inserir registro na tabela `notifications` para o `requested_by` do item
  - Mensagem: "Sua solicitação de pagamento [code] para [supplier_name] foi rejeitada. Motivo: [financial_notes]"
  - Também enviar edge function de notificação (se aplicável ao source_type)

#### 2. Reabertura de itens rejeitados

**Arquivo: `src/components/financeiro/payments/PaymentReviewDialog.tsx`**
- Quando o item tem `financial_status === 'rejected'`, exibir botão **"Reabrir / Reaprovar"** 
- Ao clicar, altera o status de volta para `pending` (para re-análise) ou diretamente para `accepted` (com criação de conta a pagar)

**Arquivo: `src/pages/FinancialPaymentCentral.tsx`**
- Adicionar handler `handleReopen` que chama `updateStatus({ financial_status: 'pending' })`

**Arquivo: `src/hooks/useFinancialPaymentQueue.ts`**
- Garantir que `syncStatusToSource` trate a transição `rejected → pending` corretamente (voltando o status da despesa de origem para `pending`)

#### 3. Correção do salvamento de PIX

**Arquivo: `src/components/fabrica/FornecedorQuickAdd.tsx`**
- Validar que ao preencher chave PIX, o tipo é obrigatório (e vice-versa)
- Mostrar alerta se preencher um sem o outro
- No `.select()` do insert, incluir `pix_chave, pix_tipo` para confirmar gravação

### Arquivos alterados
- `src/hooks/useFinancialPaymentQueue.ts` — notificação + sync de reopen
- `src/components/financeiro/payments/PaymentReviewDialog.tsx` — botão reabrir
- `src/pages/FinancialPaymentCentral.tsx` — handler reopen
- `src/components/fabrica/FornecedorQuickAdd.tsx` — validação PIX

