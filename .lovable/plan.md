

# Correções Sugeridas — Central de Pagamentos

## Nota Atual: 7.5/10

---

## Problemas Identificados

### Criticidade Alta

**1. `window as any` para armazenar dados de edição (Segurança/Memória)**
`PaymentReviewDialog.tsx` linhas 117-118 e 124-125 usam `(window as any).__editUserInfo` e `__editJustificativa` para passar dados entre funções. Isso é um antipattern grave — dados ficam acessíveis globalmente, vazam entre sessões e nunca são limpos se o dialog fechar inesperadamente.
- **Correção**: Mover para `useRef` ou state local no componente.

**2. Header duplicado no DialogContent**
`PaymentReviewDialog.tsx` tem dois `<DialogHeader>` idênticos — linhas 251-264 (fora das tabs) e linhas 281-292 (dentro da tab "details"). O título e badge aparecem duplicados na UI.
- **Correção**: Remover o `DialogHeader` duplicado dentro da `TabsContent`.

**3. Sem debounce na busca da tabela**
`PaymentQueueTable.tsx` linha 78 — `onChange` dispara query a cada keystroke via `onFiltersChange`. Com `fetchAllRows`, isso gera múltiplas queries simultâneas ao banco.
- **Correção**: Adicionar debounce de 400ms no campo de busca.

**4. `acceptPaymentMutation` — `empresa_id` fallback hardcoded**
`useFinancialPaymentQueue.ts` linha 464: `empresa_id: item.empresa_id || 1`. Se a empresa 1 não existir, o título é criado com empresa errada. Se `empresa_id` for null, deveria buscar a empresa padrão do usuário.
- **Correção**: Buscar empresa padrão do perfil do usuário em vez de hardcodar `1`.

**5. KPIs não filtram por empresa/origem**
`useFinancialPaymentQueue.ts` linhas 273-308 — a query de KPIs só filtra por `startDate`/`endDate`, ignorando `status`, `source_type` e `empresa_id`. Os KPIs mostram totais globais mesmo quando o usuário filtra a tabela por departamento ou filial.
- **Correção**: Propagar os filtros ativos para a query de KPIs.

### Criticidade Média

**6. Sem paginação na tabela**
A tabela carrega TODOS os registros via `fetchAllRows` e renderiza tudo. Com milhares de solicitações, a performance degrada significativamente.
- **Correção**: Implementar paginação server-side (20-50 itens por página).

**7. `syncStatusToSource` falha silenciosamente**
Linhas 97-164 — o `catch` apenas loga no console. Se a sincronização falhar, o status da fila fica "paid" mas a despesa original permanece "approved", gerando inconsistência.
- **Correção**: Retornar o erro para o mutation handler e exibir toast de warning.

**8. Sem confirmação antes de "Aceitar e Criar Conta"**
O botão "Aceitar" (linha 693-704) executa imediatamente, criando um título em `contas_pagar` e disparando exportação ERP. Ação irreversível sem dialog de confirmação.
- **Correção**: Adicionar `AlertDialog` de confirmação.

**9. Botão "Reabrir para Reanálise" sem justificativa**
Linha 165: `financial_notes: 'Reaberto para reanálise'` — texto fixo. Deveria exigir justificativa do usuário para auditoria.
- **Correção**: Abrir input de justificativa antes de reabrir.

**10. Filtro de data ausente na aba "Fila de Pagamentos"**
A tabela não tem filtro por período (data de vencimento ou data de criação). O usuário não consegue ver apenas itens do mês atual ou vencidos.
- **Correção**: Adicionar filtros de data (vencimento de/até).

### Criticidade Baixa

**11. `rejection_fields` não tipado corretamente**
Linha 359: `updateData.rejection_fields = rejection_fields || []`. O campo é tratado como array genérico mas deveria ter tipo definido para os campos rejeitáveis.

**12. Chat dialog na tabela não reutiliza o PaymentChatPanel do ReviewDialog**
O chat abre em dois lugares (tabela e review dialog) com implementações separadas, mas sem compartilhar estado de leitura.

**13. Export Excel não filtra — exporta tudo**
`handleExport` exporta `items` (resultado filtrado), mas como `fetchAllRows` já traz tudo, a exportação pode ser muito grande sem aviso.
- **Correção**: Adicionar confirmação com contagem antes de exportar.

**14. KPI "Rejeitados" não mostra valor monetário**
O card de rejeitados mostra apenas contagem + texto "itens", enquanto os outros mostram valor. Deveria incluir `rejectedAmount`.

---

## Plano de Implementação (14 itens)

| # | Arquivo | Correção |
|---|---------|----------|
| 1 | `PaymentReviewDialog.tsx` | Substituir `window as any` por `useRef` para `editUserInfo`/`editJustificativa` |
| 2 | `PaymentReviewDialog.tsx` | Remover `DialogHeader` duplicado (linhas 281-292) |
| 3 | `PaymentQueueTable.tsx` | Debounce 400ms no campo de busca |
| 4 | `useFinancialPaymentQueue.ts` | Remover fallback `empresa_id: 1`, buscar do perfil |
| 5 | `useFinancialPaymentQueue.ts` | Propagar filtros de empresa/origem para query de KPIs |
| 6 | `PaymentQueueTable.tsx` | Paginação server-side (50 itens/página) |
| 7 | `useFinancialPaymentQueue.ts` | `syncStatusToSource` retornar erro + toast warning |
| 8 | `PaymentReviewDialog.tsx` | AlertDialog de confirmação no "Aceitar e Criar Conta" |
| 9 | `FinancialPaymentCentral.tsx` | Justificativa obrigatória no "Reabrir para Reanálise" |
| 10 | `PaymentQueueTable.tsx` | Filtros de data (vencimento de/até) |
| 11 | `useFinancialPaymentQueue.ts` | Tipar `rejection_fields` corretamente |
| 12 | `PaymentQueueKPIs.tsx` | Adicionar `rejectedAmount` ao card de rejeitados |
| 13 | `FinancialPaymentCentral.tsx` | Confirmação com contagem antes de exportar Excel |
| 14 | `PaymentReviewDialog.tsx` | Adicionar filtro de data na aba fila |

### Arquivos afetados
- `src/components/financeiro/payments/PaymentReviewDialog.tsx` (itens 1, 2, 8)
- `src/components/financeiro/payments/PaymentQueueTable.tsx` (itens 3, 6, 10)
- `src/hooks/useFinancialPaymentQueue.ts` (itens 4, 5, 7, 11)
- `src/components/financeiro/payments/PaymentQueueKPIs.tsx` (item 12)
- `src/pages/FinancialPaymentCentral.tsx` (itens 9, 13)

