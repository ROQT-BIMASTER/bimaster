
# Plano: Revisao da Arquitetura de Telas de Aprovacao de Trade Marketing

## Resumo Executivo

A arquitetura atual de aprovacoes de Trade Marketing esta fragmentada em tres fluxos distintos sem uma experiencia unificada. Alem disso, identifiquei erros tecnicos importantes e inconsistencias que afetam a experiencia do usuario.

---

## Problemas Identificados

### 1. Erros Tecnicos Criticos

| Problema | Arquivo | Descricao |
|----------|---------|-----------|
| Query com coluna invalida | `useTradeCampaigns()` | Referencia `budget:trade_budgets(name, code, available_amount)` - a coluna `available_amount` existe no banco, porem a query falha em contextos de relacionamento aninhado |
| Exibicao de saldo incorreto | `AprovacaoCampanhaDialog.tsx` linha 297 | Usa `campaign.budget?.available_amount` que pode nao estar atualizado (valor estatico) |
| Cache desatualizado | Varios arquivos | Invalidacao de cache inconsistente entre telas de aprovacao |

### 2. Fragmentacao de Fluxos de Aprovacao

Atualmente existem 3 fluxos separados:

```text
+-----------------------------+     +-----------------------------+     +-----------------------------+
|   Aprovar Campanhas         |     |   Aprovar Lancamentos       |     |   Aprovar Orcamentos        |
|   (TradeAprovarCampanhas)   |     |   (TradeAprovacoes)         |     |   (dentro de ContasAPagar)  |
+-----------------------------+     +-----------------------------+     +-----------------------------+
        |                                    |                                    |
        v                                    v                                    v
  AprovacaoCampanha            AprovarLancamento                      AprovarOrcamento
     Dialog                        Dialog                                Dialog
```

**Problemas:**
- Nao ha visao consolidada de todas as pendencias
- Usuario precisa navegar em 3 telas diferentes
- Contadores de pendencias duplicados/inconsistentes

### 3. Inconsistencias de UX

- **Nomenclatura confusa**: "Lancamentos" vs "Investimentos" vs "Campanhas"
- **Feedback visual diferente** entre dialogs de aprovacao
- **Navegacao fragmentada**: Links para aprovacoes dispersos pelo sistema

---

## Solucao Proposta

### Fase 1: Correcao de Erros (Prioridade Alta)

#### 1.1 Corrigir Query do Hook `useTradeCampaigns`

```typescript
// src/hooks/useTradeData.ts
// Remover available_amount e calcular dinamicamente
budget:trade_budgets(id, name, code, total_amount, spent_amount, reserved_amount)
```

#### 1.2 Corrigir Exibicao de Saldo no Dialog

```typescript
// src/components/trade/campaigns/AprovacaoCampanhaDialog.tsx
// Calcular saldo disponivel dinamicamente
const availableBudget = campaign.budget 
  ? parseFloat(campaign.budget.total_amount || 0) 
    - parseFloat(campaign.budget.spent_amount || 0) 
    - parseFloat(campaign.budget.reserved_amount || 0)
  : 0;
```

#### 1.3 Padronizar Invalidacao de Cache

Apos cada aprovacao/rejeicao, invalidar todas as queries relacionadas:

```typescript
queryClient.invalidateQueries({ queryKey: ["trade-pending-campaigns"] });
queryClient.invalidateQueries({ queryKey: ["trade-campaigns"] });
queryClient.invalidateQueries({ queryKey: ["trade-budgets"] });
```

---

### Fase 2: Hub Central de Aprovacoes (Prioridade Media)

Criar uma tela unificada que consolida todas as aprovacoes pendentes de Trade Marketing.

#### Nova Estrutura

```text
+----------------------------------------------------------+
|              Centro de Aprovacoes Trade                   |
+----------------------------------------------------------+
|  [Campanhas: 3]  [Lancamentos: 5]  [Orcamentos: 2]       |
+----------------------------------------------------------+
|                                                          |
|  Campanhas Pendentes                                     |
|  +----------------------------------------------------+  |
|  | Codigo | Nome | Tipo | Custo | Periodo | Acoes    |  |
|  +----------------------------------------------------+  |
|                                                          |
+----------------------------------------------------------+
```

#### Componentes Novos

| Componente | Descricao |
|------------|-----------|
| `TradeApprovalHub.tsx` | Pagina central com tabs para cada tipo de aprovacao |
| `ApprovalKPICards.tsx` | Cards com metricas consolidadas |
| `ApprovalFilters.tsx` | Filtros unificados (data, solicitante, tipo) |

---

### Fase 3: Melhorias de UX (Prioridade Media)

#### 3.1 Padronizar Dialogs de Aprovacao

- Layout consistente entre todos os dialogs
- Mesmo fluxo de confirmacao (aprovar/rejeitar)
- Cores e icones padronizados

#### 3.2 Notificacoes Visuais

- Badge no menu lateral indicando pendencias totais
- Toast notifications mais descritivas
- Feedback de sucesso/erro consistente

#### 3.3 Validacao de Saldo em Tempo Real

Antes de aprovar qualquer item com verba vinculada:
1. Buscar saldo atualizado da verba
2. Validar disponibilidade
3. Mostrar alerta se saldo insuficiente

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/hooks/useTradeData.ts` | Corrigir query de campanhas |
| `src/components/trade/campaigns/AprovacaoCampanhaDialog.tsx` | Corrigir calculo de saldo |
| `src/pages/TradeAprovarCampanhas.tsx` | Melhorar invalidacao de cache |
| `src/pages/TradeAprovacoes.tsx` | Padronizar com novo layout |

## Novos Arquivos

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/TradeApprovalHub.tsx` | Hub central de aprovacoes (opcional - Fase 2) |
| `src/components/trade/approvals/ApprovalKPICards.tsx` | KPIs consolidados (opcional - Fase 2) |

---

## Detalhes Tecnicos

### Correcao do Hook useTradeCampaigns

O hook atual em `src/hooks/useTradeData.ts` linha 92-108 usa:

```typescript
budget:trade_budgets(name, code, available_amount)
```

Deve ser corrigido para:

```typescript
budget:trade_budgets(id, name, code, total_amount, spent_amount, reserved_amount)
```

Isso permite calcular o saldo disponivel dinamicamente onde necessario.

### Calculo de Saldo Disponivel

Formula padrao a ser usada em todo o sistema:

```typescript
const calcularSaldoDisponivel = (budget: any) => {
  if (!budget) return 0;
  return parseFloat(String(budget.total_amount || 0)) 
    - parseFloat(String(budget.spent_amount || 0)) 
    - parseFloat(String(budget.reserved_amount || 0));
};
```

### Invalidacao de Cache Padronizada

Criar funcao utilitaria:

```typescript
const invalidateTradeApprovalQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ["trade-pending-campaigns"] });
  queryClient.invalidateQueries({ queryKey: ["trade-campaigns"] });
  queryClient.invalidateQueries({ queryKey: ["trade-budgets"] });
  queryClient.invalidateQueries({ queryKey: ["trade-pending-entries"] });
  queryClient.invalidateQueries({ queryKey: ["trade-pending-investments"] });
};
```

---

## Resultado Esperado

1. **Erros corrigidos**: Queries funcionando corretamente, saldos exibidos com precisao
2. **Cache sincronizado**: Atualizacoes refletidas imediatamente em todas as telas
3. **UX profissional**: Experiencia consistente em todo o fluxo de aprovacoes
4. **Manutenibilidade**: Codigo mais organizado e reutilizavel

---

## Proximos Passos

Apos aprovacao, implementarei:

1. Correcoes tecnicas imediatas (Fase 1)
2. Opcao de criar Hub Central se desejado (Fase 2)
3. Melhorias de UX adicionais conforme necessidade (Fase 3)
