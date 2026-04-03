

# Contas a Receber — Dashboard e Calendario Zerados

## Causa Raiz

A funcao `buildRpcParams()` em `DashboardContasReceberAggregated.tsx` inclui `p_mes` em todos os parametros RPC. Porem, a funcao SQL `get_contas_receber_evolucao_mensal` NAO aceita `p_mes` na sua assinatura.

Quando o frontend chama a RPC com `p_mes`, o PostgREST retorna **404 (PGRST202)** — "function not found with those parameters". Como todas as 5 RPCs sao chamadas em `Promise.all` e os erros verificados com `throw`, o erro da evolucao faz toda a query falhar, resultando em **todos os KPIs zerados**, mesmo que as outras RPCs retornem dados validos (confirmado: KPIs retornam R$ 119M+).

## Solucao

### 1. Frontend: Separar parametros por funcao

**Arquivo:** `src/components/financeiro/DashboardContasReceberAggregated.tsx`

Na chamada `Promise.all` (linhas 91-97), remover `p_mes` dos params para `evolucao_mensal`:

```typescript
const { p_mes, ...baseParamsNoMes } = baseParams;

const [kpisRes, evolucaoRes, ...] = await Promise.all([
  supabase.rpc('get_contas_receber_dashboard_kpis', kpiParams),
  supabase.rpc('get_contas_receber_evolucao_mensal', baseParamsNoMes), // sem p_mes
  supabase.rpc('get_contas_receber_top_clientes', baseParams),
  supabase.rpc('get_contas_receber_aging', baseParams),
  supabase.rpc('get_contas_receber_status_dist', baseParams),
]);
```

### 2. Sidebar: Loop infinito residual

O console ainda mostra "Maximum update depth exceeded" no `AppSidebar.tsx`. O `useEffect` de `setOpenFinSubgroups` (linha 412) sempre cria um novo `Set` mesmo quando o valor ja existe, porem isto nao deveria causar loop — preciso verificar se o `useRef` fix foi corretamente aplicado e se ha outro effect instavel. Vou revisar e estabilizar todos os useEffects que usam Set como state.

**Arquivo:** `src/components/dashboard/AppSidebar.tsx`

Na linha 424, retornar o Set anterior se o valor ja existe:
```typescript
setOpenFinSubgroups(prev => {
  if (prev.has(sg)) return prev; // mesma referencia, sem re-render
  const next = new Set(prev);
  next.add(sg);
  return next;
});
```

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/components/financeiro/DashboardContasReceberAggregated.tsx` | Remover `p_mes` dos params de `evolucao_mensal` |
| `src/components/dashboard/AppSidebar.tsx` | Estabilizar `setOpenFinSubgroups` para evitar re-renders desnecessarios |

## Resultado Esperado

- Dashboard carrega com valores reais (R$ 119M+ em titulos, 24k pendentes, etc.)
- Evolucao mensal renderiza grafico
- Loop infinito do sidebar eliminado
- Calendario funciona (ja nao envia `p_mes`)

