
# Plano: Tornar Seleção de Verba Obrigatória na Criação de Campanha

## Objetivo
Modificar o formulário de criação de campanha para que a seleção de uma verba (budget) aprovada seja obrigatória, garantindo que todas as campanhas estejam vinculadas a uma fonte de financiamento validada pelo departamento financeiro.

## Contexto
Atualmente, o campo `budget_id` está marcado como opcional tanto no schema de validação quanto no formulário de criação. O usuário quer que apenas verbas já aprovadas pelo financeiro possam ser selecionadas, tornando esse vínculo obrigatório.

---

## Alterações Planejadas

### 1. Schema de Validação (campaign.ts)
Alterar a regra de validação do campo `budget_id` de opcional para obrigatório.

**Arquivo:** `src/lib/validations/campaign.ts`

| Campo | Antes | Depois |
|-------|-------|--------|
| `budget_id` | `.optional().nullable()` | `.uuid({ message: "Selecione uma verba" })` (obrigatório) |

---

### 2. Formulário de Criação de Campanha (TradeCampaigns.tsx)

**Alterações no formulário:**
- Alterar label de "Verba (Opcional)" para "Verba *" (indicando obrigatoriedade)
- Adicionar validação que impede submissão sem verba selecionada
- Filtrar apenas verbas com status "approved" (já aprovadas pelo financeiro)
- Exibir mensagem de erro se nenhuma verba for selecionada

**Alterações na busca de verbas:**
- Atualmente: `.eq("status", "active")`
- Proposto: `.eq("status", "approved")` ou `.in("status", ["active", "approved"])` dependendo da regra de negócio

---

### 3. Experiência do Usuário

```text
+--------------------------------------------------+
|              CRIAR NOVA CAMPANHA                  |
+--------------------------------------------------+
|                                                   |
|  Código: [________________]  Tipo: [v Sell-In]    |
|                                                   |
|  Nome: [_____________________________________]    |
|                                                   |
|  Descrição: [________________________________]    |
|                                                   |
|  ┌─────────────────────────────────────────────┐  |
|  │  Verba *                                    │  |
|  │  [v VERBA-001 - Verba Semestral (R$ 50k)]   │  |
|  │  ⚠ Apenas verbas aprovadas são exibidas    │  |
|  └─────────────────────────────────────────────┘  |
|                                                   |
|  Custo Estimado: [________]  Receita: [________]  |
|                                                   |
+--------------------------------------------------+
```

---

## Detalhes Técnicos

### Validação do formulário
```typescript
// Antes
const budget_id = formData.get("budget_id") as string || null;

// Depois
const budget_id = formData.get("budget_id") as string;
if (!budget_id) throw new Error("Selecione uma verba aprovada");
```

### Query de verbas aprovadas
```typescript
// Filtrar apenas verbas aprovadas e com saldo disponível
supabase
  .from("trade_budgets")
  .select("*")
  .in("status", ["active", "approved"])
  .is("inactivated_at", null)
  .order("name")
```

---

## Arquivos a Modificar

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/lib/validations/campaign.ts` | Tornar `budget_id` obrigatório |
| `src/pages/TradeCampaigns.tsx` | Atualizar label, validação e filtro de verbas |

---

## Benefícios

- **Controle financeiro**: Garante que todo investimento em campanhas esteja atrelado a uma verba já aprovada
- **Rastreabilidade**: Facilita a auditoria e o acompanhamento de gastos
- **Prevenção de erros**: Evita criação de campanhas sem fonte de financiamento definida
- **Fluxo aprovado**: Mantém o processo: Verba aprovada → Campanha criada → Execução
