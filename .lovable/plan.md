

# Análise: Divergência de Totais a Receber entre Ambientes

## Diagnóstico

Após confrontar os dados do banco com o código de cada tela, identifiquei **3 causas raiz** para as divergências:

### Dados reais no banco (fonte da verdade)

| Status | Registros | Valor Aberto |
|---|---|---|
| Pendente | 26.462 | R$ 34.727.509,58 |
| Vencido | 8.561 | R$ 37.415.259,14 |
| Parcial | 245 | R$ 695.116,30 |
| **Total em aberto** | **35.268** | **R$ 72.837.885,02** |

### Causa 1 — Filtros de data inconsistentes entre telas

| Tela | O que busca | Resultado |
|---|---|---|
| **Dashboard Widget** | RPC `get_financeiro_dashboard_totais` — soma pendente+parcial (exclui vencido!) | R$ 35.422.625,88 |
| **Financeiro** (`Financeiro.tsx`) | Filtra apenas vencimentos do **mês atual** | Valor parcial do mês |
| **Fluxo de Caixa** (`FluxoDeCaixa.tsx`) | Busca TUDO com status ≠ recebido, sem filtro de data na query | R$ 72.837.885,02 (se paginação OK) |

O Dashboard Widget calcula `totalAReceber = total_pendente + total_parcial` (linha 59), **ignorando os R$ 37,4M de títulos vencidos**. Isso gera uma diferença de ~R$ 37M.

### Causa 2 — Filtro por empresa do usuário vs. sem filtro

- A RPC `get_financeiro_dashboard_totais` filtra por `empresa_id = ANY(get_empresa_ids_do_usuario())`.
- O Fluxo de Caixa, quando sem filtro de empresa selecionado, busca **todas as empresas** do banco sem restrição.
- A página Financeiro também busca sem filtro de empresa.

### Causa 3 — Paginação client-side pode perder dados

O Fluxo de Caixa busca 35.268 registros via 36 batches paralelos de 1.000. Se qualquer batch falhar silenciosamente, o total fica menor. A validação (linha 166) só alerta se < 95% carregado, mas não corrige.

## Solução Proposta

### 1. Criar RPC unificada `get_total_a_receber`

Uma única RPC server-side que retorna os totais consistentes, usada por **todas** as telas:

```sql
CREATE FUNCTION get_total_a_receber(
  p_incluir_vencidos BOOLEAN DEFAULT true,
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL
) RETURNS JSONB
```

Retorna: `total_aberto`, `total_pendente`, `total_vencido`, `total_parcial`, `contagem` — sempre filtrado por empresas do usuário.

### 2. Corrigir Dashboard Widget

Alterar o cálculo de `totalAReceber` para incluir vencidos: `total_pendente + total_parcial + total_vencido`.

### 3. Corrigir Fluxo de Caixa — usar RPC para KPIs

Substituir a soma client-side dos KPIs por chamada à RPC unificada, mantendo a busca paginada apenas para os gráficos e tabelas de drill-down.

### 4. Corrigir página Financeiro

Remover o filtro de mês atual na busca de "total a receber" — o total em aberto deve considerar todos os períodos.

### 5. Aplicar filtro de empresa consistente

Todas as telas devem respeitar `get_empresa_ids_do_usuario()` para garantir que o mesmo usuário veja os mesmos valores em qualquer ambiente.

## Arquivos

| Arquivo | Alteração |
|---|---|
| Migração SQL | Criar RPC `get_total_a_receber` unificada |
| `src/components/dashboard/FinanceiroDashboardWidget.tsx` | Incluir vencidos no `totalAReceber` |
| `src/components/fluxocaixa/FluxoCaixaKPIsAdvanced.tsx` | Usar RPC para KPIs em vez de soma client-side |
| `src/pages/Financeiro.tsx` | Usar RPC para total a receber (remover filtro de mês) |
| `src/hooks/useFluxoCaixaData.ts` | Adicionar filtro de empresa via RPC quando nenhuma empresa selecionada |

