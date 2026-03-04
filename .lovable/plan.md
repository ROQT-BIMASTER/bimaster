

## Plano: Chat financeiro visível na Central de Pagamentos — por despesa + consolidado geral

### Problema

O chat por despesa já está codificado (coluna "Chat" na tabela + aba "Comunicação" no ReviewDialog), mas o usuário não consegue visualizá-lo. Além disso, falta uma visão **consolidada geral** de todas as conversas — no estilo da Fábrica (`RevisaoChatConsolidado`), com lista de conversas à esquerda e chat à direita.

### O que será feito

#### 1. Nova aba "Comunicação" na Central de Pagamentos

Adicionar uma terceira aba na página `FinancialPaymentCentral.tsx`:

```
[Fila de Pagamentos] [Dashboard Consolidado] [Comunicação]
```

Esta aba terá layout split-panel (igual à Fábrica):
- **Painel esquerdo**: Lista de todos os itens da fila que possuem mensagens, ordenados por última mensagem, com badge de não lidas, nome do fornecedor, código, e preview da última mensagem
- **Painel direito**: `PaymentChatPanel` do item selecionado, com `userType="financeiro"`

#### 2. Componente `PaymentChatConsolidado`

Novo componente inspirado no `RevisaoChatConsolidado` da Fábrica:
- Busca todos os `financial_payment_messages` agrupados por `payment_queue_id`
- Exibe lista com: código do item, fornecedor, total de mensagens, não lidas, última mensagem
- Filtro por busca (fornecedor/código)
- Indicador de itens sem resposta do financeiro
- Realtime para atualização automática

#### 3. Arquivos

| Arquivo | Ação |
|---|---|
| `src/components/financeiro/payments/PaymentChatConsolidado.tsx` | **Novo** — painel consolidado estilo Fábrica |
| `src/pages/FinancialPaymentCentral.tsx` | Adicionar aba "Comunicação" com o componente |
| `src/hooks/usePaymentMessages.ts` | Adicionar hook `useAllPaymentConversations` para listar conversas agrupadas |

