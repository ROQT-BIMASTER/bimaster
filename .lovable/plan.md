

# Garantir que Envios ao Financeiro Respeitem as Politicas

## Problema
O dialog de envio ao financeiro do Trade Marketing (`EnviarFinanceiroTradeDialog`) nao aplica as mesmas regras e validacoes que os modulos de Eventos e Departamentos ja implementam. Isso permite envios que violam politicas do financeiro.

## Lacunas Identificadas

| Regra | Departamentos | Eventos | Trade |
|-------|:---:|:---:|:---:|
| Exigir anexos | Sim | Sim | **NAO** |
| Sugestoes IA de campos | Nao | Sim | **NAO** |
| Validar status aprovado antes do envio | Sim | Sim | **PARCIAL** (so no dropdown) |
| Banner de politica de pagamento no dialog | Nao | Nao | Nao |

## O que sera feito

### 1. Exigir Anexos Obrigatorios (Trade)
Adicionar a mesma validacao que o modulo de Departamentos possui:
- Verificar se `entry.attachments` possui pelo menos 1 item
- Exibir alerta destrutivo se nao houver anexos
- Desabilitar o botao "Enviar ao Financeiro" quando nao houver anexos
- Bloquear a submissao no `handleSubmit`

### 2. Validar Status de Aprovacao no Submit
Adicionar verificacao dupla no `handleSubmit` para garantir que `entry.approval_status === 'approved'`, impedindo envios de lancamentos nao aprovados mesmo que o dialog seja aberto indevidamente.

### 3. Adicionar Sugestoes IA de Campos Financeiros
Integrar o componente `FinancialFieldsSuggestion` (ja usado no dialog de Eventos) para sugerir automaticamente tipo de documento, portador e data de vencimento com base no historico.

### 4. Adicionar Banner de Politica de Pagamento dentro do Dialog
Exibir um aviso compacto dentro do dialog informando se o envio esta dentro ou fora da janela de corte, para que o usuario saiba quando o pagamento sera processado.

## Detalhes Tecnicos

### Arquivo modificado
- `src/components/trade/EnviarFinanceiroTradeDialog.tsx`

### Alteracoes especificas

**Imports adicionais:**
- `Alert, AlertDescription` de `@/components/ui/alert`
- `AlertTriangle` de `lucide-react`
- `FinancialFieldsSuggestion` de `@/components/ai/FinancialFieldsSuggestion`
- `useActivePaymentPolicy, isWithinCutoff, getPolicySummary` de `@/hooks/useFinancialPaymentPolicies`

**Logica de anexos (seguindo padrao do EnviarFinanceiroDepDialog):**
```text
const hasAttachments = entry?.attachments && entry.attachments.length > 0;

// No JSX: Alert destrutivo se !hasAttachments
// No botao: disabled={... || !hasAttachments}
// No handleSubmit: if (!hasAttachments) return;
```

**Validacao de status no submit:**
```text
if (entry?.approval_status !== 'approved') {
  toast.error("Lancamento precisa estar aprovado");
  return;
}
```

**Banner de corte compacto:**
```text
// Dentro do dialog, antes do formulario:
// Se fora do corte: Alert amarelo informando que pagamento ira para proxima semana
// Se dentro do corte: Info discreta com data prevista de pagamento
```

**Sugestoes IA:**
```text
<FinancialFieldsSuggestion
  expenseId={entry.id}
  onApplySuggestions={(fields) => {
    setFormData(prev => ({
      ...prev,
      document_type: fields.document_type || prev.document_type,
      portador: fields.portador || prev.portador,
      due_date: fields.due_date || prev.due_date,
    }));
  }}
/>
```

### Nenhuma migracao de banco necessaria
Todas as alteracoes sao puramente de frontend, aplicando validacoes que ja existem nas tabelas e politicas do backend.

