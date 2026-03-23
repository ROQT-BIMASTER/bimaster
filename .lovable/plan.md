
# Unificação de Fornecedores — Concluído

## O que foi feito

### 1. Migração SQL
- Adicionadas colunas na tabela `fornecedores`: `tipo_conta`, `favorecido`, `linha_digitavel`, `erp_code`, `erp_sync_status`, `erp_synced_at`, `porte`, `capital_social`, `situacao_cadastral`, `matriz_filial`
- Dados migrados de `fabrica_fornecedores` para `fornecedores` (match por CNPJ)
- Tabela `fabrica_fornecedores` mantida intacta para FKs de módulos de fábrica

### 2. Página Fornecedores — Redesign
- CnpjSearchButton integrado ao formulário e à tabela
- Auto-preenchimento de campos ao consultar Receita Federal
- Painel de detalhes expansível com:
  - Badges: Situação (Ativa/Baixada), Tipo (Matriz/Filial), Porte, Regime Tributário
  - Endereço completo com telefone e email
  - Dados bancários (banco, agência, conta, PIX, boleto)
  - Dados fiscais (CNAE, IE, IM, Capital Social)
- Formulário com 3 abas: Dados Básicos, Endereço, Dados Bancários

### 3. Referências atualizadas
- `FornecedorQuickAdd.tsx` → insere em `fornecedores` com upsert por CNPJ
- `FornecedorCombobox.tsx` → seleciona de `fornecedores`
- `FornecedorPaymentInfo.tsx` → CRUD em `fornecedores`
- `FinancialSubmissionForm.tsx` → seleciona de `fornecedores`
- `SupplierPaymentExceptionsTab.tsx` → seleciona de `fornecedores`
- `SupplierDetailsCard.tsx` → CRUD em `fornecedores`
- `NovoLancamentoDialog.tsx` → busca de `fornecedores`
- `EditarLancamentoDialog.tsx` → busca de `fornecedores`
- `erp-fornecedores-query/index.ts` → query de `fornecedores` com compat `ativo`

### Arquivos mantidos com `fabrica_fornecedores` (FKs de fábrica)
- `fabrica_materias_primas` → FK `fornecedor_id`
- `fabrica_recebimentos` → FK `fornecedor_id`
- `supplier_payment_exceptions` → FK `supplier_id`
- `useSupplierPaymentExceptions.ts` → joins via FK
- Matérias primas, recebimentos, custos → joins via FK

