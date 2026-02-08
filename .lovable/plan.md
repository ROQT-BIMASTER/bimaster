

# Correcao do Erro Select.Item e Integracao da IA nos Lancamentos Financeiros

## Problema 1: Erro "Select.Item must have a value prop that is not an empty string"

### Causa Raiz
No arquivo `src/components/trade/NovoLancamentoDialog.tsx`, na linha 440, existe um `SelectItem` com valor vazio:

```
<SelectItem value="">Nenhuma campanha</SelectItem>
```

O Radix UI Select **nao permite** que um `SelectItem` tenha `value=""` (string vazia), pois o valor vazio e reservado para limpar a selecao e mostrar o placeholder. Isso causa o crash da aplicacao ao tentar abrir o dialog "Novo Lancamento".

### Correcao
- Remover o `SelectItem value=""` da lista de campanhas
- Usar `value="none"` como valor sentinela e tratar no submit para converter "none" em `null`
- Garantir que o campo `campaignId` inicie com `"none"` ao inves de `""` quando nenhuma campanha for selecionada

### Arquivo a modificar
- `src/components/trade/NovoLancamentoDialog.tsx`
  - Linha 440: Trocar `value=""` por `value="none"`
  - Linha 56: Inicializar `campaignId` como `"none"`
  - Linha 197: No submit, converter `"none"` para `null` antes de salvar
  - Linha 218/226: No reset do form, resetar para `"none"`

---

## Problema 2: Funcionalidades de IA nao aparecem na tela de Lancamentos Trade

### Causa
Os componentes de IA (Scanner OCR, Chat, Resumo, Anomalias) foram integrados nas telas de:
- Central de Aprovacoes de Departamentos (`DepartmentApprovalHub`)
- Central de Aprovacoes de Eventos (`EventsApprovalHub`)
- Dialogs de Despesas de Eventos e Departamentos

Porem, a tela de **Lancamentos Financeiros Trade** (`TradeLancamentos.tsx`) e o dialog **Novo Lancamento Trade** (`NovoLancamentoDialog.tsx`) sao componentes completamente diferentes e **nao foram incluidos** na integracao de IA.

### Correcao
Integrar os componentes de IA na tela de Lancamentos Trade:

1. **`src/components/trade/NovoLancamentoDialog.tsx`**
   - Adicionar o componente `ExpenseReceiptScanner` no topo do formulario, permitindo que o usuario escaneie um comprovante e preencha automaticamente os campos (descricao, valor, data)

2. **`src/pages/TradeLancamentos.tsx`**
   - Adicionar o `PaymentPolicyBanner` no topo da pagina para mostrar a politica financeira vigente
   - Adicionar o `ExpenseAIChatFloat` como chat flutuante para que o usuario faca perguntas sobre lancamentos

---

## Detalhes tecnicos

### Alteracoes no `NovoLancamentoDialog.tsx`
- Importar `ExpenseReceiptScanner` de `@/components/ai/ExpenseReceiptScanner`
- Adicionar o scanner antes do formulario com callback `onFieldsExtracted` que mapeia os campos extraidos (descricao, valor, data) para os estados do formulario
- Corrigir o `SelectItem` da campanha para usar `value="none"` e ajustar a logica de submit

### Alteracoes no `TradeLancamentos.tsx`
- Importar `PaymentPolicyBanner` de `@/components/financeiro/payments/PaymentPolicyBanner`
- Importar `ExpenseAIChatFloat` de `@/components/ai/ExpenseAIChatFloat`
- Renderizar o banner abaixo do header
- Renderizar o chat flutuante no final da pagina

