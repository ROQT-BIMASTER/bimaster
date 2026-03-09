

## Plano: Dialog Estruturado de Rejeição Financeira

### Problema
Atualmente, ao rejeitar uma conta, o financeiro apenas preenche um campo de texto livre. Isso não guia o solicitante sobre **qual campo corrigir** no sistema.

### Solução
Criar um `RejeicaoFinanceiraDialog` (similar ao `MarcarPagoDialog` e ao `AlterarCustoDialog` da fábrica) que estrutura a rejeição com:

1. **Categoria do problema** (Select obrigatório):
   - Dados de PIX incorretos
   - Boleto inválido / vencido
   - NF ausente ou inválida
   - Valor divergente
   - Fornecedor incorreto
   - Dados bancários incompletos (TED/DOC)
   - Documento ilegível
   - Duplicidade de lançamento
   - Outro

2. **Campos afetados** (multi-select, condicional por categoria):
   - PIX → Chave PIX, Tipo de Chave, ID Transação
   - Boleto → Linha Digitável, Data de Vencimento
   - NF → Número NF, Anexo da NF
   - Valor → Valor do Lançamento, Parcela
   - Fornecedor → Nome, CNPJ
   - TED/DOC → Banco, Agência, Conta

3. **Instruções ao solicitante** (textarea): texto livre complementar

4. **Resumo** no topo com dados da conta (código, fornecedor, valor)

### Banco de Dados
Adicionar coluna `rejection_category` (text) e `rejection_fields` (jsonb) na tabela `financial_payment_queue` para persistir a categoria e os campos afetados.

### Alterações em Código

1. **Novo componente**: `src/components/financeiro/payments/RejeicaoFinanceiraDialog.tsx`
   - Select de categoria, checkboxes de campos afetados, textarea de instruções
   - Padrão visual idêntico ao `MarcarPagoDialog`

2. **`PaymentReviewDialog.tsx`**:
   - Botão "Rejeitar" abre o `RejeicaoFinanceiraDialog` em vez de usar o campo de notas
   - O `onReject` passa category + fields + notes estruturados
   - Exibir dados da rejeição estruturada quando item já rejeitado (card com categoria, campos, instruções)

3. **`FinancialPaymentCentral.tsx`**:
   - Atualizar `handleReject` para salvar `rejection_category` e `rejection_fields`

4. **`FinancialRejectionBanner.tsx`**:
   - Exibir categoria e campos afetados de forma clara para o solicitante, indicando exatamente o que corrigir

5. **Migração SQL**:
   ```sql
   ALTER TABLE public.financial_payment_queue
   ADD COLUMN rejection_category text,
   ADD COLUMN rejection_fields jsonb DEFAULT '[]';
   ```

### Fluxo do Usuário

```text
Financeiro clica "Rejeitar"
    → Abre RejeicaoFinanceiraDialog
    → Seleciona categoria (ex: "Dados de PIX incorretos")
    → Marca campos afetados (ex: "Chave PIX", "Tipo de Chave")
    → Escreve instrução: "A chave PIX informada não confere com o CNPJ"
    → Confirma

Solicitante vê no banner:
    ┌─────────────────────────────────────────────┐
    │ ⚠ Rejeitado - Dados de PIX incorretos       │
    │ Campos a corrigir: Chave PIX, Tipo de Chave │
    │ Instrução: A chave PIX informada não...      │
    │ [Corrigir e Reenviar]                        │
    └─────────────────────────────────────────────┘
```

