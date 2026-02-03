
# Plano: Solicitar Nova Verba e Complemento de Saldo na Aprovação de Campanhas

## Resumo do Problema

Na tela de aprovação de campanha (`AprovacaoCampanhaDialog`), quando não existem verbas aprovadas ou quando as verbas existentes não têm saldo suficiente para o custo estimado da campanha, o usuário fica bloqueado sem opções de ação.

## Solução Proposta

Adicionar duas funcionalidades na tela de aprovação:

1. **Solicitar Nova Verba** - Quando não há verbas aprovadas disponíveis
2. **Solicitar Complemento de Saldo** - Quando há verbas, mas nenhuma com saldo suficiente para o custo da campanha

Ambas as solicitações ficam pendentes de aprovação do financeiro, e após aprovadas, aparecem automaticamente na lista.

---

## Fluxo de Funcionamento

```text
Cenário 1: Sem verbas aprovadas
┌────────────────────────────────────────┐
│ Aprovador abre campanha pendente       │
│            ↓                           │
│ Não há verbas aprovadas no sistema     │
│            ↓                           │
│ Exibe botão "Solicitar Nova Verba"     │
│            ↓                           │
│ Abre formulário de solicitação         │
│            ↓                           │
│ Salva com approval_status = 'pending'  │
│            ↓                           │
│ Financeiro aprova em Contas a Pagar    │
│            ↓                           │
│ Verba aparece no dropdown              │
└────────────────────────────────────────┘

Cenário 2: Verbas sem saldo suficiente
┌────────────────────────────────────────┐
│ Aprovador abre campanha pendente       │
│            ↓                           │
│ Existem verbas, mas todas com saldo    │
│ menor que o custo estimado             │
│            ↓                           │
│ Exibe opção "Solicitar Complemento"    │
│            ↓                           │
│ Seleciona verba para complementar      │
│            ↓                           │
│ Informa valor do complemento           │
│            ↓                           │
│ Salva solicitação pendente             │
│            ↓                           │
│ Financeiro aprova aumento de saldo     │
│            ↓                           │
│ Saldo atualizado automaticamente       │
└────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/trade/SolicitarComplementoDialog.tsx` | **Criar** | Novo dialog para solicitar complemento de saldo em verba existente |
| `src/components/trade/campaigns/AprovacaoCampanhaDialog.tsx` | **Modificar** | Adicionar botões e estados para as duas opções |
| `src/hooks/useTradeData.ts` | **Modificar** | Adicionar hook para buscar verbas pendentes de aprovação |

---

## Detalhes de Implementação

### 1. Novo Componente: SolicitarComplementoDialog

Formulário similar ao `SolicitarOrcamentoDialog`, mas para complemento:

- Exibe informações da verba selecionada (código, nome, saldo atual)
- Exibe o déficit necessário (custo da campanha - saldo disponível)
- Campo para valor do complemento solicitado (pré-preenchido com o déficit)
- Campo de justificativa
- Salva uma nova solicitação de verba com referência à verba original

### 2. Modificações no AprovacaoCampanhaDialog

**Novos estados:**
- `solicitarVerbaOpen` - controla dialog de nova verba
- `solicitarComplementoOpen` - controla dialog de complemento
- `selectedBudgetForComplement` - verba selecionada para receber complemento

**Nova lógica de detecção:**
- `hasBudgetsAvailable` - existe pelo menos uma verba aprovada
- `hasAnyWithSufficientBalance` - alguma verba tem saldo >= custo estimado
- `budgetsWithInsufficientBalance` - verbas com saldo < custo estimado

**Nova seção de UI quando não há verbas suficientes:**

```text
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Vinculação de Verba Obrigatória                      │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 💡 Não há verbas com saldo suficiente para esta     │ │
│ │    campanha (Custo: R$ 15.000,00)                   │ │
│ │                                                     │ │
│ │ Você pode:                                          │ │
│ │                                                     │ │
│ │ ○ [📝 Solicitar Nova Verba ao Financeiro]           │ │
│ │                                                     │ │
│ │ ○ Solicitar complemento em verba existente:         │ │
│ │   ┌───────────────────────────────────────────────┐ │ │
│ │   │ CAMP-2025 - Verão (Disp: R$ 8.000,00)    [+]  │ │ │
│ │   │ TRADE-01 - Q1 (Disp: R$ 5.000,00)        [+]  │ │ │
│ │   └───────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📋 Solicitações em análise:                             │
│    • VERBA-2025-02 - R$ 50.000,00 (aguardando)         │
└─────────────────────────────────────────────────────────┘
```

### 3. Hook para Verbas Pendentes

Novo hook `usePendingBudgets` em `useTradeData.ts`:

```typescript
export function usePendingBudgets() {
  return useQuery({
    queryKey: ['trade-pending-budgets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_budgets")
        .select("*")
        .eq("approval_status", "pending")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });
}
```

---

## Modelo de Dados para Complemento

O complemento será salvo como uma nova entrada na tabela `trade_budgets` com uma nota na justificativa referenciando a verba original:

```typescript
{
  name: "Complemento - [NOME_VERBA_ORIGINAL]",
  code: "[CODIGO_ORIGINAL]-COMP-001",
  total_amount: valorComplemento,
  period_start: mesmaDataVerbaOriginal,
  period_end: mesmaDataVerbaOriginal,
  notes: `Complemento de saldo para verba ${codigoOriginal}. 
          Solicitado para campanha: ${nomeCampanha}. 
          Déficit: R$ ${deficit}`,
  approval_status: "pending",
  status: "inactive",
  requested_by: userId,
  requester_name: nomeUsuario,
  requester_email: emailUsuario,
}
```

Quando aprovado pelo financeiro, o valor será incorporado à verba original (ou fica como verba separada que pode ser vinculada à campanha).

---

## Comportamento Visual

### Sem verbas aprovadas:
- Mensagem explicativa
- Botão único "Solicitar Nova Verba"
- Lista de verbas pendentes (se houver)

### Com verbas, mas sem saldo suficiente:
- Dropdown de seleção de verbas (todas, mesmo sem saldo)
- Quando seleciona uma com saldo insuficiente:
  - Badge "Saldo Insuficiente" em vermelho
  - Botão "Solicitar Complemento de R$ X" aparece
- Botão secundário "Ou solicitar nova verba"
- Lista de verbas/complementos pendentes

### Com verba e saldo OK:
- Comportamento atual (aprovação normal)

---

## Callbacks e Invalidação de Cache

Após criar solicitação de verba ou complemento:

```typescript
queryClient.invalidateQueries({ queryKey: ['trade-budgets'] });
queryClient.invalidateQueries({ queryKey: ['trade-pending-budgets'] });
toast.success("Solicitação enviada ao financeiro!");
```

---

## Resultado Esperado

1. Usuário pode solicitar nova verba diretamente da tela de aprovação
2. Usuário pode solicitar complemento de saldo em verba existente
3. Solicitações aparecem como pendentes com visual claro
4. Após aprovação financeira, verbas ficam disponíveis automaticamente
5. Fluxo integrado sem necessidade de navegar para outras telas
