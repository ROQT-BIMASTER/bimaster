

## Plano: Replicar sistema de parcelas, tipo de documento e linha digitável para Eventos e Departamentos

### Escopo

Trazer para **corporate_event_expenses** e **department_expenses** as mesmas funcionalidades já implementadas no Trade:
1. Parcelamento com anexos individuais por parcela
2. Tipo de documento (Orçamento/NF/Boleto) com badge "Pendente NF"
3. Linha digitável do boleto por parcela
4. Agrupamento visual de parcelas nas tabelas

### 1. Migração de banco

Adicionar 4 colunas em cada tabela:

```sql
-- corporate_event_expenses
ALTER TABLE corporate_event_expenses
  ADD COLUMN installment_group_id text,
  ADD COLUMN installment_number integer,
  ADD COLUMN installment_total integer,
  ADD COLUMN boleto_barcode text;

-- department_expenses
ALTER TABLE department_expenses
  ADD COLUMN installment_group_id text,
  ADD COLUMN installment_number integer,
  ADD COLUMN installment_total integer,
  ADD COLUMN boleto_barcode text;
```

### 2. Dialogs de criação de despesa (parcelamento + documento + boleto)

**`NovaDespesaEventoDialog.tsx`** e **`NovaDespesaDepartamentoDialog.tsx`**:
- Adicionar toggle "Parcelar valor" (2-12x) — mesmo padrão do Trade
- Cada parcela com: valor, data de vencimento, tipo de documento, linha digitável, anexos individuais
- Na submissão, gerar múltiplos registros com `installment_group_id` compartilhado
- Validação: soma das parcelas = valor total

### 3. Tabelas de despesas (badges e agrupamento)

**`EventsExpensesTable.tsx`** e **`DepartmentExpensesTable.tsx`**:
- Badge de parcela (`1/3`, `2/3`) quando `installment_number` existir
- Badge "Pendente NF" quando `document_type === "orcamento"`
- Ícone de boleto com tooltip e botão copiar quando `boleto_barcode` preenchido
- Coluna de tipo de documento

### 4. Dialogs de envio ao financeiro

**`EnviarFinanceiroDialog.tsx`** (eventos) e **`EnviarFinanceiroDepDialog.tsx`** (departamentos):
- Alerta contextual "Parcela X de Y" quando aplicável
- Incluir linha digitável nas notas de pagamento

### 5. Dialogs de aprovação

**`AprovarDespesaDepartamentoDialog.tsx`**:
- Quando a despesa pertencer a um grupo de parcelas, exibir as irmãs como contexto
- Botão "Aprovar todas as parcelas"

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| Migração SQL | 4 colunas em 2 tabelas |
| `src/components/events/NovaDespesaEventoDialog.tsx` | Parcelamento + doc type + boleto |
| `src/components/departments/NovaDespesaDepartamentoDialog.tsx` | Parcelamento + doc type + boleto |
| `src/components/events/EventsExpensesTable.tsx` | Badges parcela/NF/boleto |
| `src/components/departments/DepartmentExpensesTable.tsx` | Badges parcela/NF/boleto |
| `src/components/events/EnviarFinanceiroDialog.tsx` | Contexto parcela |
| `src/components/departments/EnviarFinanceiroDepDialog.tsx` | Contexto parcela |
| `src/components/departments/AprovarDespesaDepartamentoDialog.tsx` | Aprovação em lote |

