

## Plano: Corrigir chat financeiro — colunas incorretas e acesso

### Problema identificado

Dois problemas distintos:

1. **Colunas inexistentes nos hooks**: Os hooks `useAvailablePaymentQueues` e `useAllPaymentConversations` referenciam colunas que **não existem** na tabela `financial_payment_queue`:
   - `fornecedor` → deveria ser `supplier_name`
   - `descricao` → deveria ser `description`  
   - `valor` → deveria ser `amount`
   - `vencimento` → deveria ser `due_date`

   Isso causa erro silencioso na query (retorna dados vazios ou falha).

2. **Tabela vazia**: A `financial_payment_queue` tem 0 registros. As despesas dos departamentos só entram na fila quando são enviadas ao financeiro (via `useDepartmentExpenses`). Se nenhuma despesa foi enviada ainda, o chat não tem itens para exibir.

3. **Acesso RLS**: O usuário atual (vendedor, departamento Comercial) pode não ter acesso à `financial_payment_queue` — a policy `fpq_select_policy` exige admin, `can_access_payment_queue` (departamento Financeiro/Tesouraria/Controladoria), ou `requested_by = auth.uid()`. Um vendedor do Comercial só vê itens que ele mesmo solicitou.

### Alterações

**`src/hooks/usePaymentMessages.ts`**:
- Corrigir `useAvailablePaymentQueues`: usar `supplier_name`, `description`, `amount`, `due_date` em vez de `fornecedor`, `descricao`, `valor`, `vencimento`
- Corrigir `useAllPaymentConversations`: mesma correção no select e mapeamento dos dados de `financial_payment_queue`

**Sem migração necessária** — o schema está correto, o código é que usa nomes errados.

### Resultado esperado

Após a correção, o botão "Nova Conversa" exibirá as despesas disponíveis na fila (quando houverem), e as conversas existentes serão exibidas corretamente com nome do fornecedor e descrição.

