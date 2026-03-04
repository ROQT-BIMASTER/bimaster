

## Plano: Parcelas com anexos individuais, linha digitável e integração sistêmica

### Problema atual

1. Parcelas compartilham um único conjunto de anexos (só a 1ª parcela recebe)
2. Não há campo para linha digitável do boleto
3. Parcelas não são tratadas como grupo coeso no restante do sistema (aprovação, envio ao financeiro, dashboard)

### O que será feito

#### 1. Migração de banco: adicionar colunas para parcelas

Adicionar 2 novas colunas na tabela `trade_financial_entries`:

- `installment_group_id` (text, nullable) — substitui o hack de `PARC-` no `reference_number` por um campo dedicado que permite consultas eficientes
- `installment_number` (integer, nullable) — número da parcela (1, 2, 3...)
- `installment_total` (integer, nullable) — total de parcelas no grupo
- `boleto_barcode` (text, nullable) — linha digitável do boleto para pagamento

#### 2. NovoLancamentoDialog: anexos e boleto por parcela

Refatorar a UI de parcelas para que cada parcela tenha:

- **Campo de anexo individual** (reutilizando `ExpenseAttachments`) — cada parcela recebe seu próprio documento (NF, boleto, etc.)
- **Campo "Linha digitável"** — input de texto para colar a linha do boleto
- **Tipo de documento por parcela** — cada parcela pode ter tipo diferente (parcela 1 = orçamento, parcela 2 = boleto, etc.)

A estrutura `Parcela` passa a ser:
```typescript
interface Parcela {
  numero: number;
  valor: number;
  dueDate: string;
  boletoBarcode: string;
  attachments: any[];
  documentType: string;
  tempId: string; // para o ExpenseAttachments
}
```

Na submissão, cada entrada no banco recebe seus próprios anexos, boleto e `installment_group_id` compartilhado.

#### 3. Tabela de lançamentos: agrupamento visual de parcelas

Na `TradeLancamentos.tsx`:

- Exibir ícone de boleto quando `boleto_barcode` estiver preenchido (com tooltip mostrando a linha)
- Botão "copiar linha digitável" inline
- Filtro para agrupar/visualizar parcelas do mesmo grupo

#### 4. Envio ao financeiro: parcelas como itens individuais

No `EnviarFinanceiroTradeDialog.tsx`:

- Quando o lançamento faz parte de um grupo de parcelas, exibir alerta informando "Esta é a parcela X de Y"
- Cada parcela é enviada individualmente ao `financial_payment_queue` com seus próprios anexos e `due_date`
- A linha digitável do boleto é passada como `notes` ou campo dedicado na fila de pagamento

#### 5. Hub de aprovações: visão de grupo

Na aprovação de lançamentos parcelados:

- Ao aprovar uma parcela, exibir as demais parcelas do grupo como contexto
- Permitir "aprovar todas as parcelas do grupo" de uma vez

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| Migração SQL | Adicionar `installment_group_id`, `installment_number`, `installment_total`, `boleto_barcode` |
| `src/components/trade/NovoLancamentoDialog.tsx` | Refatorar parcelas com anexos/boleto individuais |
| `src/pages/TradeLancamentos.tsx` | Exibir boleto, melhorar agrupamento visual |
| `src/components/trade/EnviarFinanceiroTradeDialog.tsx` | Contexto de parcela no envio |
| `src/components/trade/EditarLancamentoDialog.tsx` | Adicionar campo boleto e anexos na edição |

