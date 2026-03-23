

# Fluxo Solicitações de Pagamento → Contas a Pagar

## Situação Atual

O sistema tem **3 formulários separados** que enviam para a `financial_payment_queue` (Central de Pagamentos):

```text
┌─────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│  Trade           │    │  Departamentos        │    │  Eventos             │
│  EnviarFinanceiro│    │  EnviarFinanceiroDep  │    │  useEventExpenses    │
│  TradeDialog.tsx │    │  Dialog.tsx           │    │  sendToFinancial     │
└────────┬────────┘    └──────────┬───────────┘    └──────────┬───────────┘
         │                        │                           │
         └────────────┬───────────┴───────────────────────────┘
                      ▼
         ┌────────────────────────┐
         │ financial_payment_queue │  ← Central de Pagamentos (sua tela)
         └────────────┬───────────┘
                      │ acceptPaymentMutation
                      ▼
         ┌────────────────────────┐
         │     contas_pagar       │  ← Título criado automaticamente
         └────────────┬───────────┘
                      │ exportPaymentToErp
                      ▼
         ┌────────────────────────┐
         │     ERP (Provisão)     │
         └────────────────────────┘
```

### O que já funciona

Quando o financeiro clica **"Aceitar"** na Central de Pagamentos, o hook `useFinancialPaymentQueue.ts` (linha 434-529):
1. Cria um registro em `contas_pagar` com dados do fornecedor, valor, vencimento
2. Salva o `contas_pagar_id` de volta na `financial_payment_queue`
3. Exporta automaticamente a provisão ao ERP

### Problema: Formulários duplicados e inconsistentes

Os 3 dialogs de envio ao financeiro são **cópias quase idênticas** com diferenças sutis:

| Campo | Trade | Departamentos | Eventos |
|-------|-------|---------------|---------|
| Fornecedor (Combobox) | ✅ | ✅ | ✅ |
| Tipo Documento | ✅ | ✅ | ✅ |
| Nº Documento | ✅ | ✅ | ✅ |
| Vencimento | ✅ | ✅ | ✅ |
| Portador | ✅ | ✅ | ✅ |
| Parcelas (split) | ✅ | ✅ | ❌ |
| Política de pagamento | ✅ | ✅ | ❌ |
| Regras de correção | ✅ | ✅ | ❌ |
| Sugestão IA | ✅ | ✅ | ❌ |
| Quick Add Fornecedor | ✅ | ✅ | ❌ |
| Código de barras | ❌ | ❌ | ✅ |

### Problema: CadastroTituloAP é desconectado

O formulário `CadastroTituloAP` (Painel Central AP) cria títulos diretamente na API `contas-pagar-api/incluir`, **sem vínculo com a fila de pagamentos**. São dois caminhos paralelos que não se comunicam.

---

## Plano de Padronização

### 1. Criar componente compartilhado `FinancialSubmissionForm`

Extrair a lógica comum dos 3 dialogs em um único componente reutilizável:

**Arquivo**: `src/components/shared/FinancialSubmissionForm.tsx`

Campos padronizados:
- Fornecedor (Combobox com Quick Add)
- CNPJ (auto-preenchido)
- Tipo de Documento (select padronizado)
- Número do Documento
- Data de Vencimento
- Portador (select de contas bancárias)
- Parcelas (opcional, com split)
- Código de Barras (opcional)
- Observações
- Sugestão IA de campos
- Banner de Política de Pagamento
- Regras de Correção (em modo correção)

Props de customização:
- `sourceType`: 'trade' | 'department_expense' | 'event_expense'
- `initialData`: dados pré-preenchidos da despesa original
- `isCorrection`: boolean para modo reenvio
- `correctionLocks`: campos travados pelo financeiro
- `onSubmit`: callback com payload padronizado

### 2. Refatorar os 3 dialogs para usar o componente compartilhado

- `EnviarFinanceiroTradeDialog.tsx` → wrapper fino sobre `FinancialSubmissionForm`
- `EnviarFinanceiroDepDialog.tsx` → wrapper fino sobre `FinancialSubmissionForm`
- Eventos (inline) → criar `EnviarFinanceiroEventDialog.tsx` wrapper

Cada wrapper apenas:
- Busca os dados da despesa original
- Chama o `sendToFinancial` do hook específico
- Passa `sourceType` e `initialData`

### 3. Vincular CadastroTituloAP à fila (opcional)

Adicionar no `CadastroTituloAP` um campo opcional "Vincular à Solicitação" que permite selecionar um item pendente da `financial_payment_queue` e pré-preencher os dados. Ao salvar, atualiza o `contas_pagar_id` na fila.

---

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/components/shared/FinancialSubmissionForm.tsx` | **Criar** — componente unificado |
| `src/components/trade/EnviarFinanceiroTradeDialog.tsx` | Refatorar para usar componente compartilhado |
| `src/components/departments/EnviarFinanceiroDepDialog.tsx` | Refatorar para usar componente compartilhado |
| `src/components/events/EnviarFinanceiroEventDialog.tsx` | **Criar** — wrapper para Eventos |
| `src/hooks/useFinancialSubmission.ts` | **Criar** — hook compartilhado com lógica de submit/correção |

### Benefícios
- Correção de bug em um único lugar propaga para todos os módulos
- Novos campos (ex: código de barras, categoria) ficam disponíveis em todos os formulários
- Eventos ganham parcelamento, política de pagamento e sugestão IA automaticamente
- Manutenção reduzida de ~1.200 linhas duplicadas para ~400 linhas compartilhadas

