
# Plano: Criacao de Campanha sem Verba + Vinculo Obrigatorio na Aprovacao

## Objetivo
Modificar o fluxo para permitir que campanhas sejam criadas sem verba vinculada, porem exigir a vinculacao de uma verba aprovada no momento da aprovacao da campanha.

## Contexto Atual
- A verba e obrigatoria no momento da criacao
- A tela de aprovacao (`TradeAprovacoes.tsx`) nao exibe campanhas pendentes
- O componente `CampaignValidation.tsx` aprova campanhas, mas nao exige verba

---

## Alteracoes Planejadas

### 1. Formulario de Criacao de Campanha

**Arquivo:** `src/pages/TradeCampaigns.tsx`

| Alteracao | Descricao |
|-----------|-----------|
| Remover obrigatoriedade | Campo verba passa de obrigatorio para opcional |
| Atualizar label | De "Verba *" para "Verba (Opcional)" |
| Atualizar texto auxiliar | Explicar que verba sera obrigatoria na aprovacao |
| Remover validacao | Remover `if (!budget_id) throw new Error(...)` |

---

### 2. Schema de Validacao

**Arquivo:** `src/lib/validations/campaign.ts`

| Campo | Antes | Depois |
|-------|-------|--------|
| `budget_id` | `.uuid({ message: "..." })` obrigatorio | `.uuid().optional().nullable()` |

---

### 3. Componente de Validacao de Campanha (PRINCIPAL)

**Arquivo:** `src/components/trade/campaigns/CampaignValidation.tsx`

Adicionar selecao obrigatoria de verba quando a campanha nao tiver verba vinculada:

```text
+--------------------------------------------------+
|         VALIDACAO DE CAMPANHA                     |
+--------------------------------------------------+
|                                                   |
|  ⚠️ Esta campanha nao possui verba vinculada      |
|                                                   |
|  Verba *                                          |
|  [v VERBA-001 - Semestral (Disponivel: R$ 50k)]   |
|                                                   |
|  [Aprovar Campanha]   [Rejeitar]                  |
+--------------------------------------------------+
```

**Logica:**
- Se `campaign.budget_id` existe: comportamento atual (aprovar normalmente)
- Se `campaign.budget_id` nao existe: exibir select de verba obrigatorio antes de aprovar
- Ao aprovar, atualizar a campanha com o `budget_id` selecionado

---

### 4. Inclusao de Campanhas na Tela de Aprovacao

**Arquivo:** `src/pages/TradeAprovacoes.tsx`

Adicionar campanhas pendentes de aprovacao na lista:

| Alteracao | Descricao |
|-----------|-----------|
| Novo hook | Buscar campanhas com `status = 'pending_approval'` |
| Nova secao | Exibir campanhas pendentes na tabela |
| Dialog especifico | Ao clicar em "Revisar", abrir dialog de aprovacao de campanha |

---

### 5. Novo Componente: Dialog de Aprovacao de Campanha

**Arquivo:** `src/components/trade/campaigns/AprovacaoCampanhaDialog.tsx`

```text
+----------------------------------------------------------+
|         REVISAR CAMPANHA                                  |
+----------------------------------------------------------+
|                                                           |
|  Nome: Campanha Black Friday 2025                         |
|  Tipo: Sell-Out                                           |
|  Custo Estimado: R$ 15.000,00                             |
|  Periodo: 01/11/2025 - 30/11/2025                         |
|                                                           |
|  +-------------------------------------------------+      |
|  |  ⚠️ VINCULACAO DE VERBA OBRIGATORIA             |      |
|  |                                                 |      |
|  |  Verba *                                        |      |
|  |  [v Selecione uma verba aprovada          v]    |      |
|  |                                                 |      |
|  |  💰 Disponivel: R$ 45.000,00                    |      |
|  |  📊 Custo campanha: R$ 15.000,00                |      |
|  +-------------------------------------------------+      |
|                                                           |
|  [Cancelar]   [Rejeitar]   [Aprovar e Vincular Verba]     |
+----------------------------------------------------------+
```

---

## Fluxo de Trabalho Atualizado

```text
1. Usuario cria campanha (verba opcional)
     |
     v
2. Campanha salva como "draft" (rascunho)
     |
     v
3. Usuario envia para aprovacao
     |
     v
4. Campanha aparece em TradeAprovacoes
     |
     v
5. Supervisor abre dialog de aprovacao
     |
     +-- Se tem verba: aprovar normalmente
     |
     +-- Se NAO tem verba: OBRIGATORIO selecionar verba antes de aprovar
     |
     v
6. Campanha aprovada com verba vinculada
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/validations/campaign.ts` | Tornar `budget_id` opcional |
| `src/pages/TradeCampaigns.tsx` | Remover obrigatoriedade da verba |
| `src/pages/TradeAprovacoes.tsx` | Adicionar campanhas pendentes |
| `src/hooks/useTradeData.ts` | Adicionar hook para campanhas pendentes |
| `src/components/trade/campaigns/AprovacaoCampanhaDialog.tsx` | **NOVO** - Dialog de aprovacao com selecao de verba |

---

## Beneficios

- **Flexibilidade**: Permite criar campanhas mesmo antes de ter verba aprovada
- **Controle**: Garante que toda campanha aprovada tenha verba vinculada
- **Rastreabilidade**: Supervisor e responsavel pela vinculacao ficam registrados
- **Fluxo natural**: Alinha com o processo onde verbas podem ser aprovadas depois

---

## Secao Tecnica

### Query para campanhas pendentes:
```typescript
supabase
  .from("trade_campaigns")
  .select(`
    *,
    budget:trade_budgets(id, name, code, available_amount),
    responsible:profiles!responsible_user_id(nome, email)
  `)
  .eq("status", "pending_approval")
  .is("deleted_at", null)
  .order("created_at", { ascending: false })
```

### Logica de aprovacao com verba:
```typescript
// Se nao tem verba e nenhuma foi selecionada
if (!campaign.budget_id && !selectedBudgetId) {
  throw new Error("Selecione uma verba para aprovar esta campanha");
}

// Atualizar campanha
const { error } = await supabase
  .from("trade_campaigns")
  .update({
    budget_id: selectedBudgetId || campaign.budget_id,
    status: "approved",
    validation_status: "approved",
    validated_by: user.id,
    validated_at: new Date().toISOString(),
  })
  .eq("id", campaignId);
```

### Validar saldo disponivel:
```typescript
// Verificar se verba tem saldo suficiente
const available = budget.total_amount - budget.spent_amount - budget.reserved_amount;
if (available < campaign.estimated_cost) {
  throw new Error(`Saldo insuficiente. Disponivel: R$ ${available.toFixed(2)}`);
}
```
