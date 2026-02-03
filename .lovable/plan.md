
# Plano: Tour Guiado na Revisão de Campanha + Integração com Verbas Semestrais

## Objetivo

Criar um tour interativo que guie o usuário passo a passo ao revisar uma campanha, explicando cada seção e ação possível. Além disso, melhorar a integração visual entre o fluxo de aprovação de campanhas e a tela de Verbas Semestrais.

---

## Mudanças Propostas

### 1. Criar Tour para o Dialog de Aprovação de Campanha

Novo arquivo de tour que será ativado automaticamente quando o dialog abrir (para usuários que nunca viram) ou manualmente via botão de ajuda.

**Passos do tour:**

| Passo | Elemento | Explicação |
|-------|----------|------------|
| 1 | Cabeçalho do dialog | "Revisar Campanha - Aqui você analisa os detalhes antes de aprovar" |
| 2 | Informações da campanha | "Verifique: código, tipo, nome, período e custo estimado" |
| 3 | Dados do solicitante | "Quem criou a campanha e quando" |
| 4 | Seção de vinculação de verba | "Obrigatório! Selecione uma verba com saldo suficiente" |
| 5 | Botão solicitar verba | "Sem verba? Clique aqui para solicitar ao Financeiro" |
| 6 | Campo de observações | "Adicione notas para registro interno" |
| 7 | Campo de rejeição | "Se rejeitar, informe o motivo para o solicitante" |
| 8 | Botões de ação | "Escolha: Cancelar, Rejeitar ou Aprovar" |
| 9 | Resumo final | "Após aprovar, a verba será reservada. Gerencie verbas em Verbas Semestrais" |

### 2. Adicionar Atributos data-tour nos Elementos

Inserir os atributos `data-tour` nos elementos do `AprovacaoCampanhaDialog` para que o driver.js possa identificá-los.

### 3. Adicionar Botão de Ajuda no Dialog

Incluir um ícone de ajuda (?) no canto superior do dialog que inicia o tour sob demanda.

### 4. Link Direto para Verbas Semestrais

Na seção de solicitação de verba e na mensagem de verbas pendentes, adicionar um link visual para "Acessar Planejamento de Verbas" que leva para `/dashboard/trade/financeiro/verbas`.

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/tour/tours/tradeCampaignApprovalTour.ts` | **Criar** | Definição dos passos do tour |
| `src/components/tour/tours/index.ts` | **Modificar** | Exportar o novo tour |
| `src/components/tour/index.ts` | **Modificar** | Exportar o novo tour |
| `src/components/trade/campaigns/AprovacaoCampanhaDialog.tsx` | **Modificar** | Adicionar data-tour, botão de ajuda e links |

---

## Interface Visual

### Botão de Ajuda no Dialog

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 Revisar Campanha                              [?] [✕]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Conteúdo do dialog com atributos data-tour]              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Link para Verbas Semestrais

Na seção de verbas pendentes:
```
┌─────────────────────────────────────────────────────────────┐
│ ⏳ 2 solicitações aguardando aprovação financeira           │
│    • VERBA-2025-01 - R$ 50.000,00                          │
│    • COMP-XYZ - R$ 10.000,00                               │
│                                                             │
│    📊 Ver Planejamento de Verbas →                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Tour Steps (tradeCampaignApprovalTour.ts)

```typescript
export const tradeCampaignApprovalTourSteps: DriveStep[] = [
  {
    element: '[data-tour="approval-header"]',
    popover: {
      title: "Revisão de Campanha",
      description: "Analise os detalhes da campanha antes de tomar sua decisão de aprovação ou rejeição.",
      side: "bottom",
    },
  },
  {
    element: '[data-tour="approval-info"]',
    popover: {
      title: "Informações da Campanha",
      description: "Verifique: código, tipo, nome, descrição, período de execução e custo estimado.",
      side: "right",
    },
  },
  // ... demais passos
];
```

### Integração no Dialog

```tsx
import { useTour } from "@/components/tour";
import { HelpCircle } from "lucide-react";
import { tradeCampaignApprovalTourSteps, TRADE_CAMPAIGN_APPROVAL_TOUR_ID } from "@/components/tour";

// No componente:
const { startTour, hasSeenTour } = useTour();

// Iniciar tour automaticamente na primeira vez:
useEffect(() => {
  if (open && !hasSeenTour(TRADE_CAMPAIGN_APPROVAL_TOUR_ID)) {
    setTimeout(() => startTour(TRADE_CAMPAIGN_APPROVAL_TOUR_ID, tradeCampaignApprovalTourSteps), 500);
  }
}, [open]);

// Botão manual:
<Button variant="ghost" size="icon" onClick={() => startTour(...)}>
  <HelpCircle className="h-4 w-4" />
</Button>
```

### Link para Verbas

```tsx
import { Link } from "react-router-dom";

// No PendingBudgetsInfo:
<Link 
  to="/dashboard/trade/financeiro/verbas" 
  className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-2"
>
  📊 Ver Planejamento de Verbas →
</Link>
```

---

## Resultado Esperado

1. Ao abrir o dialog de aprovação pela primeira vez, o tour inicia automaticamente
2. Usuário pode reiniciar o tour clicando no botão de ajuda (?)
3. Cada seção do dialog é explicada de forma clara
4. Link direto para Verbas Semestrais facilita a navegação
5. Integração visual entre aprovação de campanhas e gestão de verbas

