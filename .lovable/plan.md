
# Plano: Unificar Validação de Verba na Aprovação de Campanhas

## Problema
Existem dois caminhos para aprovar campanhas:

1. **Central de Aprovações** (`AprovacaoCampanhaDialog.tsx`) - ✅ Exige verba
2. **Aba Validação na Campanha** (`CampaignValidation.tsx`) - ❌ Não exige verba

O usuário usou o segundo caminho, resultando em campanha aprovada sem verba vinculada, e consequentemente os R$ 900 não foram debitados.

## Solução

### 1. Adicionar Validação de Verba no CampaignValidation.tsx
Modificar o componente para:
- Adicionar seletor de verba obrigatório antes de aprovar
- Validar saldo disponível antes de aprovar
- Atualizar `budget_id` da campanha junto com a aprovação
- Consumir crédito da verba quando aprovar despesas

### 2. Corrigir Dados Existentes
Executar SQL para vincular a campanha "COMPRE E GANHE RR - 03" à verba "01TESTE" e debitar os R$ 900:

```sql
-- 1. Vincular campanha à verba
UPDATE trade_campaigns
SET budget_id = (SELECT id FROM trade_budgets WHERE code = '01TESTE')
WHERE id = 'add2757e-e00e-49ac-9a31-c3a0959c7bfe';

-- 2. Atualizar spent_amount da verba
UPDATE trade_budgets
SET spent_amount = COALESCE(spent_amount, 0) + 900
WHERE code = '01TESTE';
```

---

## Detalhes Técnicos

### Modificações no CampaignValidation.tsx

```typescript
// Adicionar state para verba selecionada
const [selectedBudgetId, setSelectedBudgetId] = useState<string>(campaign.budget_id || "");

// Buscar verbas aprovadas
const { data: budgets = [] } = useQuery({
  queryKey: ["trade-budgets-approved"],
  queryFn: async () => {
    const { data } = await supabase
      .from("trade_budgets")
      .select("*")
      .eq("status", "approved")
      .is("inactivated_at", null);
    return data || [];
  },
});

// Na mutação approveCampaign, exigir verba
const approveCampaign = useMutation({
  mutationFn: async () => {
    const finalBudgetId = selectedBudgetId || campaign.budget_id;
    
    if (!finalBudgetId) {
      throw new Error("Selecione uma verba para aprovar esta campanha");
    }

    // Atualizar campanha COM budget_id
    await supabase
      .from("trade_campaigns")
      .update({
        budget_id: finalBudgetId, // <-- ADICIONAR ISSO
        validation_status: "approved",
        status: "approved",
        // ...
      })
      .eq("id", campaignId);
  },
});
```

### Interface Adicionada
Adicionar um seletor de verba antes do botão "Aprovar Campanha" mostrando:
- Lista de verbas aprovadas com saldo
- Comparação: Disponível vs Custo Estimado
- Indicador visual de saldo OK ou insuficiente

## Resultado Esperado
- Ambos os caminhos de aprovação exigirão seleção de verba
- Dados existentes serão corrigidos
- Futuras aprovações debitarão corretamente da verba
