

# Verificação de Consistência de Valores — Banco vs Telas

## Dados Reais do Banco (verificados agora)

### Contas a Receber
| Métrica | Valor BD |
|---|---|
| Total registros | 374.800 |
| Recebidos | 341.155 (R$ 489.440.958,81) |
| Pendentes | 25.943 (R$ 38.596.751,12) |
| Vencidos | 7.149 (R$ 36.662.188,04) |
| Parciais | 553 (R$ 2.510.387,17) |
| Soma valor_recebido | R$ 482.157.219,48 |

### Contas a Pagar
| Métrica | Valor BD |
|---|---|
| Total registros | 47.566 |
| Pagos | 42.970 (R$ 471.260.820,25) |
| Pendentes | 945 (R$ 40.864.896,79) |
| Vencidos | 3.562 (R$ 170.634.504,28) |
| Parciais | 89 (R$ 2.699.638,98) |
| Total aberto | R$ 213.499.448,46 |

### Financeiro (Mês Abril/2026)
| Métrica | Valor BD |
|---|---|
| A Pagar aberto (abril) | R$ 9.548.300,26 |
| A Receber aberto (abril) | R$ 15.377.206,10 |
| Vencidas Pagar (abril) | 16 |
| Vencidas Receber (abril) | 613 |

## Resultado da Auditoria

### Telas CONSISTENTES (sem ação necessária)

| Tela | Status | Fonte de Dados | Campo de Valor |
|---|---|---|---|
| **Contas a Receber** (Dashboard) | OK | RPCs server-side com filtro empresa | `valor_aberto`, `valor_original`, `valor_recebido` corretos |
| **Contas a Pagar** (Dashboard) | OK | Client-side com paginação completa | `valor_aberto` para pendentes, `valor_original` para totais |
| **Financeiro** (Overview) | OK | `fetchAllRows` + paginação manual, mês corrente | `valor_aberto` para saldo |
| **Fluxo de Caixa** | OK | `fetchPaginatedData` paralela, exclui quitados (design correto para projeção) | `valor_aberto` para pendentes |
| **Formatação** | OK | `formatCurrency` centralizada com 2 decimais em todos os módulos |

### Bug Encontrado: DRE Analítico — Comparativo YoY

| Problema | Impacto |
|---|---|
| Query YoY (ano anterior) sempre usa `data_vencimento` como filtro de período, ignorando o `regimeAnalise` | Quando em regime de **Caixa**, deveria filtrar por `data_pagamento` (despesas pagas) e `status = 'pago'`. Hoje puxa títulos vencidos no ano anterior independente de terem sido pagos, inflando/distorcendo a comparação |

**Correção**: Replicar a lógica condicional do regime (linhas 319-327) na query YoY (linhas 382-393).

## Plano de Correção

### 1. Fix DRE YoY — Respeitar regime de análise
**Arquivo**: `src/pages/DREAnalitico.tsx` (linhas 376-397)

Alterar a query `lancamentos-dre-yoy` para:
- Regime Caixa: filtrar `status = 'pago'` + `data_pagamento` no range do ano anterior
- Regime Competência: manter filtro por `data_vencimento` (como está)

```typescript
// ANTES (sempre usa data_vencimento):
query = query
  .gte('data_vencimento', anoAnteriorInicio)
  .lte('data_vencimento', anoAnteriorFim);

// DEPOIS (respeita regime):
if (regimeAnalise === 'caixa') {
  query = query
    .eq('status', 'pago')
    .gte('data_pagamento', anoAnteriorInicio)
    .lte('data_pagamento', anoAnteriorFim);
} else {
  query = query
    .gte('data_vencimento', anoAnteriorInicio)
    .lte('data_vencimento', anoAnteriorFim);
}
```

Também adicionar `regimeAnalise` à queryKey do YoY (atualmente ausente).

### Resumo

| Item | Nota |
|---|---|
| Contas a Pagar | 100% |
| Contas a Receber | 100% |
| Fluxo de Caixa | 100% |
| DRE Analítico | 95% → 100% após fix YoY |
| Financeiro Overview | 100% |
| Formatação | 100% |

**Apenas 1 arquivo alterado**: `src/pages/DREAnalitico.tsx`

