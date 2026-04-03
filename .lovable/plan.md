

# Dashboard de Métricas de Performance da Sync

## O que será criado

Uma nova página dedicada com dashboard completo de métricas, acessível via tab "Métricas" na página de sincronização. O dashboard terá:

1. **KPI Cards** — Taxa de sucesso (%), média rows/s, total registros sincronizados, total execuções, deadlocks, erros
2. **Gráfico de Tendência: Throughput** — Linha temporal de rows/s por execução
3. **Gráfico de Tendência: Duração** — Área mostrando duração (s) por execução, com cores por status
4. **Gráfico de Barras: Volume por Empresa** — Total de rows processados agrupados por empresa_id
5. **Gráfico de Status** — Donut/pie com distribuição success/error/partial
6. **Tabela Detalhada** — Todas as métricas com filtros por empresa e entity

## Estrutura

| Arquivo | Ação |
|---|---|
| `src/components/financeiro/SyncMetricsDashboard.tsx` | Novo componente principal |
| `src/pages/financeiro/ContasReceberSyncPage.tsx` | Adicionar tab "Métricas" |

## Implementação

- Dados via `supabase.from("sync_metrics")` com limit 200, ordered by `created_at DESC`
- Usa `ChartContainer` existente para wrapper dos gráficos
- Recharts (já instalado) para Line, Area, Bar, Pie charts
- `chartColors` do `src/lib/chart-colors.ts` para paleta consistente
- KPIs calculados client-side a partir dos dados brutos
- Filtro por período (últimas 24h, 7 dias, 30 dias) e por empresa
- Auto-refresh a cada 60s via `refetchInterval`

