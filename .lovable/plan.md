
# Conectar Lancamentos Trade a Central de Pagamentos

## Resumo
O fluxo atual do Trade Marketing esta incompleto: apos a aprovacao do gestor, nao existe o passo "Enviar ao Financeiro" que insere o registro na `financial_payment_queue`. Os modulos de Eventos e Departamentos ja possuem esse mecanismo. Vamos replicar o mesmo padrao para o Trade.

## O que sera feito

### 1. Criar `EnviarFinanceiroTradeDialog.tsx`
Novo dialog seguindo o padrao exato do `EnviarFinanceiroDialog.tsx` (Eventos). Campos:
- **Fornecedor** (Combobox com busca, pre-preenchido se ja informado no lancamento)
- **CNPJ/CPF** (auto-preenchido ao selecionar fornecedor)
- **Tipo de Documento** (NF, Boleto, Recibo, etc.)
- **Numero do Documento**
- **Data de Vencimento**
- **Portador/Forma de Pagamento** (usando `usePortadores`)
- **Observacoes para Pagamento**

Ao submeter:
1. Atualiza `trade_financial_entries` com `send_to_financial: true`, `status: 'pending_financial'`, e os dados do documento
2. Insere registro na `financial_payment_queue` com `source_type: 'trade_entry'`, `source_id`, valor, fornecedor, anexos e empresa
3. Salva o `payment_queue_id` de volta no lancamento para rastreabilidade

### 2. Atualizar `TradeLancamentos.tsx`
- Adicionar acao "Enviar ao Financeiro" no `DropdownMenu` para lancamentos com `approval_status === 'approved'` e `send_to_financial !== true`
- Adicionar estado e renderizacao do `EnviarFinanceiroTradeDialog`
- Adicionar status `pending_financial` no badge e no filtro de status
- Adicionar KPI ou badge visual para lancamentos ja enviados ao financeiro

### 3. Atualizar `AprovarLancamentoDialog.tsx` (opcional mas recomendado)
Adicionar botao "Aprovar e Enviar ao Financeiro" como atalho para o gestor que deseja fazer as duas acoes de uma vez, reduzindo cliques.

## Detalhes Tecnicos

### Nenhuma migracao necessaria
A tabela `trade_financial_entries` ja possui todos os campos necessarios: `send_to_financial`, `payment_queue_id`, `document_type`, `document_number`, `due_date`, `portador`, `supplier_name`, `supplier_document`. A tabela `financial_payment_queue` ja suporta `source_type: 'trade_entry'`.

### Arquivos criados
- `src/components/trade/EnviarFinanceiroTradeDialog.tsx` -- Dialog com formulario de envio, reutilizando `usePortadores`, `DOCUMENT_TYPES`, Combobox de fornecedor e `FornecedorQuickAdd`

### Arquivos modificados
- `src/pages/TradeLancamentos.tsx` -- Adicionar acao no dropdown, estado do dialog, status `pending_financial` no badge/filtro
- `src/components/trade/AprovarLancamentoDialog.tsx` -- Botao opcional "Aprovar e Enviar"

### Fluxo completo apos implementacao

```text
Lancamento criado (pending)
    |
    v
Gestor aprova na Central de Aprovacoes (approved)
    |
    v
Usuario clica "Enviar ao Financeiro" no dropdown (pending_financial)
    |
    v
Registro inserido na financial_payment_queue
    |
    v
Financeiro processa na Central de Pagamentos (paid)
```

### Insert na financial_payment_queue
Seguira exatamente o padrao de Eventos:
- `source_type: 'trade_entry'`
- `source_id: entry.id`
- `amount: entry.amount` (valor realizado)
- `supplier_name`, `supplier_document` do formulario
- `document_type`, `document_number`, `due_date`, `portador` do formulario
- `attachments: entry.attachments`
- `empresa_id`, `empresa_nome` do lancamento
- `department_name: 'Trade Marketing'`
- `requested_by: user.id`
