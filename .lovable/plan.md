

## Plano: Alinhar Dialog de Envio ao Financeiro (Eventos) com o Padrão Trade

### Diferenças Identificadas

O dialog de Eventos (`EnviarFinanceiroDialog.tsx`) está defasado em relação ao Trade (`EnviarFinanceiroTradeDialog.tsx`):

| Recurso | Trade | Eventos |
|---------|-------|---------|
| Exibição de parcelas irmãs com status | Sim (busca `installment_group_id`) | Apenas "Parcela X de Y" |
| Histórico de auditoria (`financial_payment_queue_history`) | Sim — registra `submitted`/`corrected` | Não — delega ao hook `sendToFinancial` |
| Error handling com `getSafeErrorMessage` | Sim | Não |
| Lógica de upsert (correção vs primeiro envio) | Manual com controle completo | Delegada ao hook |

### Alterações

**1. `EnviarFinanceiroDialog.tsx` — Refatorar para seguir o padrão Trade**

- **Buscar parcelas irmãs**: Quando a despesa pertence a um `installment_group_id`, buscar as outras parcelas do grupo na tabela `corporate_event_expenses` e exibir em um card com número, valor, vencimento e status (badge `Pendente`/`Aprovada`/`Enviada`)
- **Substituir `sendToFinancial.mutateAsync`** por lógica manual idêntica ao Trade:
  - Inserir/atualizar diretamente na `financial_payment_queue`
  - Registrar snapshot na `financial_payment_queue_history` com ação `submitted` ou `corrected`
  - Atualizar campos na `corporate_event_expenses` (document_type, due_date, portador, etc.)
- **Adicionar `getSafeErrorMessage`** para tratamento de erros padronizado
- **Adicionar seção visual de parcelas irmãs** (igual ao segundo screenshot):
  ```text
  ┌─────────────────────────────────────┐
  │ 📋 Parcela 3 de 3                   │
  │ ┌─────────────────────────────────┐ │
  │ │ Outras parcelas do grupo:       │ │
  │ │ 1/3  R$ 9.310,00  03/04  Pend. │ │
  │ │ 2/3  R$ 9.310,00  03/05  Pend. │ │
  │ └─────────────────────────────────┘ │
  └─────────────────────────────────────┘
  ```

**2. Campos salvos na despesa ao enviar**

Gravar os mesmos campos que o Trade salva na entidade de origem:
- `supplier_name`, `supplier_document`, `document_type`, `document_number`, `due_date`, `portador`, `payment_notes`, `payment_queue_id`

### Arquivos Modificados
- `src/components/events/EnviarFinanceiroDialog.tsx` — refatoração completa para paridade com Trade

