

# Unificação de Fornecedores — Tabela Unica + Consulta CNPJ

## Diagnóstico

O sistema tem **duas tabelas de fornecedores independentes**:

| Aspecto | `fornecedores` | `fabrica_fornecedores` |
|---------|---------------|----------------------|
| Usado por | Página /fornecedores, ContasPagarTabContent | Fila de pagamentos, Trade, Eventos, QuickAdd, FornecedorPaymentInfo |
| Campos bancários | Sim (chave_pix, tipo_pix, conta_bancaria) | Sim (pix_chave, pix_tipo, banco, agencia, conta) |
| Empresa | empresa_id (int) | Nao tem |
| ERP | codigo_externo, fonte_erp | erp_code, erp_synced_at |
| Endereço | endereco, bairro, cidade, estado, cep | endereco, bairro, cidade, uf, cep |
| Status | status (ativo/inativo/bloqueado) | ativo (boolean) |
| CNPJ | cnpj (obrigatório) | cnpj (opcional) |

A imagem de referência mostra um painel de detalhes do fornecedor com consulta Receita Federal (badges Ativa/Matriz/ME/Simples), dados bancários e botão "Atualizar Cadastro" — funcionalidade que não existe na tela atual.

## Estrategia: `fornecedores` como tabela unica

A tabela `fornecedores` é mais completa (empresa_id, campos tributarios, endereço detalhado). Vamos:

1. **Adicionar campos faltantes** na tabela `fornecedores` (dados bancarios PIX, erp_code, erp_synced_at)
2. **Migrar dados** de `fabrica_fornecedores` para `fornecedores`
3. **Criar view** `fabrica_fornecedores` apontando para `fornecedores` (compatibilidade temporaria)
4. **Atualizar a pagina** Fornecedores com consulta CNPJ e painel de detalhes

## Plano de Implementacao

### 1. Migracao SQL
- Adicionar colunas em `fornecedores`: `banco`, `agencia`, `conta_corrente`, `tipo_conta`, `favorecido`, `pix_tipo_novo`, `pix_chave_nova`, `linha_digitavel`, `erp_code`, `erp_sync_status`, `erp_synced_at`, `inscricao_estadual` (se nao existe), `inscricao_municipal`
- INSERT de registros de `fabrica_fornecedores` que nao existam em `fornecedores` (match por CNPJ)
- UPDATE registros existentes com dados bancarios de `fabrica_fornecedores`

### 2. Pagina Fornecedores — Redesign com detalhes e consulta CNPJ
- Adicionar `CnpjSearchButton` ao formulario de cadastro/edicao
- Auto-preencher campos ao consultar (razao social, endereco, situacao, porte, CNAE, regime tributario)
- Adicionar painel de detalhes expandivel na tabela (como na imagem de referencia):
  - Badges: Situacao (Ativa/Baixada), Tipo (Matriz/Filial), Porte (ME/EPP), Regime
  - Endereco completo
  - Telefone e email
  - Dados bancarios (Cadastro) com botao "Atualizar Cadastro"
  - PIX com chave

### 3. Atualizar referencias de `fabrica_fornecedores` no frontend
Arquivos a atualizar para usar `fornecedores`:
- `FornecedorQuickAdd.tsx` — insert em `fornecedores`
- `FinancialSubmissionForm.tsx` — select de `fornecedores`
- `FornecedorPaymentInfo.tsx` — select/update de `fornecedores`
- `SupplierPaymentExceptionsTab.tsx` — select de `fornecedores`
- `FornecedorCombobox.tsx` — select de `fornecedores`
- `erp-fornecedores-query/index.ts` — query de `fornecedores`

### 4. Edge function `opencnpj-consulta` — ja funciona, sem mudancas

## Arquivos afetados

| Arquivo | Acao |
|---------|------|
| Nova migracao SQL | Adicionar colunas + migrar dados |
| `src/pages/Fornecedores.tsx` | Redesign com CnpjSearchButton, painel de detalhes expandivel |
| `src/components/fabrica/FornecedorQuickAdd.tsx` | Trocar `fabrica_fornecedores` por `fornecedores` |
| `src/components/shared/FinancialSubmissionForm.tsx` | Trocar tabela |
| `src/components/shared/FornecedorPaymentInfo.tsx` | Trocar tabela |
| `src/components/financeiro/payments/SupplierPaymentExceptionsTab.tsx` | Trocar tabela |
| `src/components/trade/FornecedorCombobox.tsx` | Trocar tabela |
| `supabase/functions/erp-fornecedores-query/index.ts` | Trocar tabela |

### Compatibilidade
- A view `fabrica_fornecedores` mantem o sistema funcionando durante a transicao
- Modulos de fabrica (materias primas, recebimentos) continuam operando via view
- Nenhuma funcionalidade existente e quebrada

