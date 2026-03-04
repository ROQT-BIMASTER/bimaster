

## Plano: Adicionar botão "Nova Conversa" no chat consolidado

### Problema

O painel de Comunicação no Contas a Pagar (e na Central de Pagamentos) aparece em branco porque só exibe conversas que já possuem mensagens. Não há como o financeiro **iniciar** uma conversa — ele precisa selecionar uma despesa da fila de pagamentos para vincular.

### Solução

Adicionar um botão "Nova Conversa" no topo do painel de conversas do `PaymentChatConsolidado`. Ao clicar, abre um dialog/popover com uma lista pesquisável de itens da `financial_payment_queue` (que ainda não possuem conversas). O usuário seleciona um item e o chat é aberto — a primeira mensagem enviada cria a conversa.

### Alterações

**`src/components/financeiro/payments/PaymentChatConsolidado.tsx`**:
- Adicionar botão "Nova Conversa" (ícone `Plus`) ao lado do título "Conversas"
- Ao clicar, abrir um Dialog com lista pesquisável de itens da `financial_payment_queue`
- Filtrar itens que já possuem conversas ativas (excluir `paymentQueueIds` já listados)
- Ao selecionar um item, criar um `PaymentConversation` temporário e abrir o `PaymentChatPanel` no painel direito
- A conversa só será persistida quando a primeira mensagem for enviada (comportamento já existente do `PaymentChatPanel`)

**`src/hooks/usePaymentMessages.ts`** (ou novo hook):
- Adicionar query para buscar itens da `financial_payment_queue` disponíveis para nova conversa (sem mensagens existentes)

### Fluxo do usuário

1. Abre aba "Comunicação" no Contas a Pagar
2. Vê lista de conversas (ou vazio)
3. Clica em "+ Nova Conversa"
4. Dialog abre com lista pesquisável de despesas da fila de pagamentos
5. Seleciona uma despesa (fornecedor, valor, vencimento visíveis)
6. Chat abre no painel direito com o `paymentQueueId` selecionado
7. Digita e envia a primeira mensagem — conversa criada

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/components/financeiro/payments/PaymentChatConsolidado.tsx` | Adicionar botão + dialog de nova conversa |
| `src/hooks/usePaymentMessages.ts` | Adicionar hook para buscar itens disponíveis |

